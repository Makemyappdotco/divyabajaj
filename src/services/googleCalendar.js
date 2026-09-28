// Google Calendar sync for Divya's own calendar.
//
// One connection per environment (test/production), stored encrypted in
// Supabase - see supabase/migrations/006_google_calendar_connection.sql. No
// SDK, same reasoning as razorpay.js: this is a handful of REST calls and
// every dependency is bundle weight on a cold start.
//
// This fails QUIET everywhere a booking already treats it as optional -
// store.listAvailability's own comment says availability must keep working
// off Divya's own rules if Google is down or not yet connected, and a
// confirmed, paid booking must never be undone by a calendar failure, the
// same rule paymentRoutes.js already applies to the WhatsApp/email
// confirmation. Only the OAuth connect/callback flow itself throws, because
// there a human is looking at the screen and can be told what went wrong.

const crypto = require('crypto');
const db = require('../database');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const STATE_TTL_MS = 10 * 60 * 1000;

function clientId() { return process.env.GOOGLE_CLIENT_ID || ''; }
function clientSecret() { return process.env.GOOGLE_CLIENT_SECRET || ''; }
function redirectUri() { return process.env.GOOGLE_OAUTH_REDIRECT_URI || ''; }

function encryptionKey() {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
  if (!raw) return null;
  // The key we asked to be generated is 32 random bytes as 64 hex chars; used
  // as-is. Anything else (someone pastes a passphrase instead) is hashed down
  // to 32 bytes so this can never crash createCipheriv on key length.
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

/** Whether the Google Cloud side has been wired up at all. */
function isConfigured() {
  return Boolean(clientId() && clientSecret() && redirectUri() && encryptionKey());
}

// ------------------------------------------------------------ token at rest

function encrypt(text) {
  const key = encryptionKey();
  if (!key) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(text || ''), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decrypt(blob) {
  const key = encryptionKey();
  if (!key || !blob) return '';
  const raw = Buffer.from(blob, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------- signed OAuth state

/**
 * Google's `state` round-trips through the user's browser and nothing else,
 * so it doubles as the only place to carry which environment (test or
 * production) started the connection, signed so it cannot be forged into
 * connecting the wrong one. Same truncated-HMAC shape as services/reportLinks.js.
 */
function stateSecret() {
  return process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.REPORT_DOWNLOAD_SECRET || '';
}

function signState(environment) {
  const payload = `${environment}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}`;
  const sig = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}.${sig}`, 'utf8').toString('base64url');
}

/** Returns the environment the link was minted for, or null if it does not check out. */
function verifyState(state) {
  try {
    const parts = Buffer.from(String(state || ''), 'base64url').toString('utf8').split('.');
    if (parts.length !== 4) return null;
    const [environment, ts, nonce, signature] = parts;
    const payload = `${environment}.${ts}.${nonce}`;
    const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex').slice(0, 32);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(ts) > STATE_TTL_MS) return null;
    return environment;
  } catch (error) {
    return null;
  }
}

// -------------------------------------------------------------------- storage

function client() {
  const supabase = db.getSupabaseClient();
  if (!supabase) throw new Error('Google Calendar needs Supabase; this environment is on local fallback storage.');
  return supabase;
}

async function getRow(environment) {
  const { data, error } = await client()
    .from('google_calendar_connections').select('*').eq('environment', environment).maybeSingle();
  if (error) throw new Error(`Load Google Calendar connection failed: ${error.message}`);
  return data;
}

async function saveConnection({ environment, tokens, accountEmail }) {
  if (!tokens.refresh_token) {
    // buildAuthUrl always sends prompt=consent specifically so this branch
    // should never run - a connection with no way to refresh itself is worse
    // than no connection at all, so it is refused rather than half-saved.
    throw new Error(
      'Google did not return a refresh token. Remove "Divya Bajaj Booking" at ' +
      'https://myaccount.google.com/permissions and try connecting again.'
    );
  }

  const existing = await getRow(environment);
  const nowIso = new Date().toISOString();
  const row = {
    environment,
    google_account_email: accountEmail || (existing && existing.google_account_email) || '',
    calendar_id: 'primary',
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    access_token_encrypted: encrypt(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString(),
    scope: tokens.scope || '',
    updated_at: nowIso
  };

  const supabase = client();
  if (existing) {
    const { error } = await supabase.from('google_calendar_connections').update(row).eq('environment', environment);
    if (error) throw new Error(`Save Google Calendar connection failed: ${error.message}`);
  } else {
    const { error } = await supabase.from('google_calendar_connections')
      .insert(Object.assign({ id: `gcal_${crypto.randomBytes(8).toString('hex')}`, connected_at: nowIso }, row));
    if (error) throw new Error(`Save Google Calendar connection failed: ${error.message}`);
  }
}

async function disconnect(environment) {
  const { error } = await client().from('google_calendar_connections').delete().eq('environment', environment);
  if (error) throw new Error(`Disconnect failed: ${error.message}`);
}

/** What the admin panel shows. Never throws - a broken check should read as "not connected", not crash the schedule tab. */
async function getStatus(environment) {
  if (!isConfigured()) {
    return { connected: false, note: 'Google Calendar is not connected yet.' };
  }
  try {
    const row = await getRow(environment);
    if (!row) return { connected: false, note: 'Google Calendar is not connected yet.' };
    return {
      connected: true,
      account_email: row.google_account_email || '',
      note: row.google_account_email
        ? `Connected as ${row.google_account_email}.`
        : 'Connected.'
    };
  } catch (error) {
    console.error('[googleCalendar:status]', error.message);
    return { connected: false, note: 'Could not check the Google Calendar connection right now.' };
  }
}

// --------------------------------------------------------------------- OAuth

function buildAuthUrl(state) {
  if (!isConfigured()) {
    throw new Error('Google Calendar is not set up yet (missing client id, secret, redirect URI, or encryption key).');
  }
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Forces Google to hand back a refresh_token even if Divya connected
    // before and only ever gets a consent screen once for the same account -
    // without this, a reconnect after any local disconnect would silently
    // fail to persist.
    prompt: 'consent',
    state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: redirectUri(), grant_type: 'authorization_code'
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Google token exchange failed (${response.status})`);
  }
  return payload;
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(),
      grant_type: 'refresh_token'
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Google token refresh failed (${response.status})`);
  }
  return payload;
}

async function getValidAccessToken(environment, rowMaybe) {
  const row = rowMaybe || await getRow(environment);
  if (!row) throw new Error('Google Calendar is not connected.');

  const stillValid = row.access_token_expires_at &&
    new Date(row.access_token_expires_at).getTime() - Date.now() > 60000;
  if (stillValid && row.access_token_encrypted) return decrypt(row.access_token_encrypted);

  const tokens = await refreshAccessToken(decrypt(row.refresh_token_encrypted));
  await client().from('google_calendar_connections').update({
    access_token_encrypted: encrypt(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }).eq('environment', environment);

  return tokens.access_token;
}

/** Finishes the flow after Google redirects back with a code. */
async function completeConnection({ environment, code }) {
  const tokens = await exchangeCode(code);

  // The primary calendar's own `id` IS the connected account's email address -
  // the cheapest way to show "connected as ..." in the panel without asking
  // for a separate profile/email scope the sync itself never needs.
  let accountEmail = '';
  try {
    const response = await fetch(`${CAL_API}/calendars/primary`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) accountEmail = payload.id || '';
  } catch (error) {
    console.error('[googleCalendar:accountEmail]', error.message);
  }

  await saveConnection({ environment, tokens, accountEmail });
  return { accountEmail };
}

// ---------------------------------------------------------------- freebusy

/**
 * Busy ranges from Divya's own calendar, in the shape computeSlots already
 * expects ({start, end}). Always resolves - never rejects - so a customer's
 * availability call can plug this straight into store.listAvailability({
 * busy }) without its own try/catch, exactly as that function's doc comment
 * describes: Google being down or not connected must fall back to her own
 * rules, not take the booking page down.
 */
async function getBusyTimes({ environment, from, to }) {
  try {
    const row = await getRow(environment);
    if (!row) return [];

    const accessToken = await getValidAccessToken(environment, row);
    const calendarId = row.calendar_id || 'primary';
    const response = await fetch(`${CAL_API}/freeBusy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(to).toISOString(),
        items: [{ id: calendarId }]
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[googleCalendar:freebusy]', payload.error || response.status);
      return [];
    }
    const busy = (payload.calendars && payload.calendars[calendarId] && payload.calendars[calendarId].busy) || [];
    return busy.map(b => ({ start: b.start, end: b.end }));
  } catch (error) {
    console.error('[googleCalendar:freebusy]', error.message);
    return [];
  }
}

// ----------------------------------------------------------------- events

/**
 * Creates the calendar event for a just-confirmed, paid appointment.
 * Returns null (not an error) when Calendar simply is not connected, so a
 * caller can `if (result) ...` without a separate isConnected check.
 *
 * sendUpdates: 'none' - the app's own WhatsApp/email confirmation already
 * tells the customer, and a second invite landing from Divya's personal
 * Gmail address with none of that context would be confusing rather than
 * helpful.
 */
async function createEventForAppointment({ environment, appointment, lead }) {
  const row = await getRow(environment);
  if (!row) return null;

  const accessToken = await getValidAccessToken(environment, row);
  const calendarId = row.calendar_id || 'primary';
  const timeZone = appointment.timezone_id || 'Asia/Kolkata';

  const description = [
    lead && lead.phone ? `Phone: ${lead.phone}` : null,
    lead && lead.email ? `Email: ${lead.email}` : null,
    appointment.customer_question ? `Question: ${appointment.customer_question}` : null
  ].filter(Boolean).join('\n');

  const response = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        summary: `Consultation - ${(lead && lead.name) || 'Divya Bajaj client'}`,
        description,
        start: { dateTime: appointment.starts_at, timeZone },
        end: { dateTime: appointment.ends_at, timeZone },
        attendees: lead && lead.email ? [{ email: lead.email, displayName: lead.name || '' }] : [],
        conferenceData: {
          createRequest: { requestId: appointment.id, conferenceSolutionKey: { type: 'hangoutsMeet' } }
        }
      })
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload.error && payload.error.message) || `Google Calendar event create failed (${response.status})`);
  }

  const meetEntry = payload.conferenceData && Array.isArray(payload.conferenceData.entryPoints)
    ? payload.conferenceData.entryPoints.find(e => e.entryPointType === 'video')
    : null;

  return {
    calendarId,
    eventId: payload.id,
    meetingUrl: payload.hangoutLink || (meetEntry && meetEntry.uri) || ''
  };
}

/** Best-effort cleanup when a booking is cancelled or moved off the calendar. Never throws. */
async function cancelEventForAppointment({ environment, appointment }) {
  if (!appointment || !appointment.calendar_event_id) return;
  try {
    const row = await getRow(environment);
    if (!row) return;
    const accessToken = await getValidAccessToken(environment, row);
    const calendarId = appointment.calendar_id || row.calendar_id || 'primary';
    const response = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(appointment.calendar_event_id)}?sendUpdates=none`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    );
    // 404/410 mean it is already gone from the calendar - fine, not an error.
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const payload = await response.json().catch(() => ({}));
      throw new Error((payload.error && payload.error.message) || `status ${response.status}`);
    }
  } catch (error) {
    console.error('[googleCalendar:cancelEvent]', error.message);
  }
}

module.exports = {
  isConfigured, getStatus, disconnect,
  signState, verifyState, buildAuthUrl, completeConnection,
  getBusyTimes, createEventForAppointment, cancelEventForAppointment
};
