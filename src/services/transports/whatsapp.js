// WhatsApp, through Uomox.
//
// Uomox is a WhatsApp Business Solution Provider, which means it resells Meta's
// Cloud API. Every BSP puts its own wrapper around it, so the ONE thing that
// varies between them is the HTTP shape: the URL, the auth header, and whether
// the body is Meta's own JSON or something flatter.
//
// That variation is the whole reason this file is configured rather than
// hardcoded. UOMOX_API_STYLE picks the body shape:
//
//   uomox  - Uomox's own shape: {destination, templateName, templateParams,
//            media, buttons}, confirmed against their own Postman docs
//            (https://documenter.getpostman.com/view/46192021/2sB2xEC9Ng).
//            This is what Divya's Uomox account actually speaks - use this.
//   cloud  - Meta's Cloud API JSON, which most OTHER BSPs pass straight
//            through unchanged
//   simple - a flat {to, template, params} body, which some others use
//
// Getting this wrong is not loud. A BSP will happily answer 200 to a body it
// only half understands and deliver nothing, so send() treats anything that is
// not an explicit success as a failure, and the panel shows what came back.
//
// WHY TEMPLATES: Meta forbids free text to someone who has not messaged the
// business in the last 24 hours. A customer who paid on the website has not.
// So customer messages MUST use a template approved in advance, and all we
// supply are the numbered blanks. Divya's own alerts can be free text because
// she will have messaged her own business number.

function baseUrl() { return String(process.env.UOMOX_API_URL || '').replace(/\/$/, ''); }
function apiKey() { return process.env.UOMOX_API_KEY || ''; }
function sender() { return process.env.UOMOX_SENDER || ''; }
function style() { return (process.env.UOMOX_API_STYLE || 'uomox').toLowerCase(); }

function templateName(key) {
  const map = {
    free_report_ready: process.env.UOMOX_TEMPLATE_FREE_REPORT || 'free_report_ready',
    payment_received: process.env.UOMOX_TEMPLATE_PAYMENT_RECEIVED || 'payment_received',
    report_ready: process.env.UOMOX_TEMPLATE_REPORT_READY || 'blueprint_ready',
    refunded: process.env.UOMOX_TEMPLATE_REFUNDED || 'blueprint_refunded',
    consultation_confirmed: process.env.UOMOX_TEMPLATE_CONSULTATION || 'consultation_confirmed',
    consultation_reminder_day: process.env.UOMOX_TEMPLATE_REMINDER_DAY || 'consultation_reminder_day',
    consultation_reminder_hour: process.env.UOMOX_TEMPLATE_REMINDER_HOUR || 'consultation_reminder_hour',
    consultation_moved: process.env.UOMOX_TEMPLATE_MOVED || 'consultation_moved',
    consultation_cancelled: process.env.UOMOX_TEMPLATE_CANCELLED || 'consultation_cancelled',
    // Marketing. These carry an opt-out button and require real consent.
    free_to_blueprint_1: process.env.UOMOX_TEMPLATE_FREE_UPSELL_1 || 'free_to_blueprint_1',
    free_to_blueprint_2: process.env.UOMOX_TEMPLATE_FREE_UPSELL_2 || 'free_to_blueprint_2',
    checkout_abandoned: process.env.UOMOX_TEMPLATE_ABANDONED || 'checkout_abandoned',
    blueprint_to_consultation: process.env.UOMOX_TEMPLATE_BLUEPRINT_UPSELL || 'blueprint_to_consultation',
    post_call_followup: process.env.UOMOX_TEMPLATE_POST_CALL || 'post_call_followup'
  };
  return map[key] || key;
}

function language() { return process.env.UOMOX_TEMPLATE_LANG || 'en'; }

/**
 * Uomox's own API has no concept of "sender" in the request at all - the
 * WhatsApp number is tied to the access token itself, not sent alongside it.
 * A sender is only actually needed for the 'simple' style (which puts it in
 * the body) or when the URL itself carries a {sender} placeholder - so it is
 * only required in those two cases, not universally.
 */
function isConfigured() {
  if (!baseUrl() || !apiKey()) return false;
  if (style() === 'simple' || baseUrl().includes('{sender}')) return Boolean(sender());
  return true;
}

/**
 * India-first, because every customer here types a 10-digit number.
 * Meta wants a full international number with no plus and no punctuation.
 */
function normalise(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  // 0-prefixed local form, as people often paste it.
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function authHeaders() {
  const scheme = process.env.UOMOX_AUTH_SCHEME || 'Bearer';
  const header = process.env.UOMOX_AUTH_HEADER || 'Authorization';
  return {
    'Content-Type': 'application/json',
    [header]: scheme === 'none' ? apiKey() : `${scheme} ${apiKey()}`
  };
}

/** Meta Cloud API body: components, numbered parameters, optional URL button. */
function cloudBody({ to, template, bodyParams, buttonUrlSuffix, text, documentUrl, documentName }) {
  if (text) {
    return { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
  }

  const components = [];

  // The PDF itself, as a document header. Meta fetches this URL server-side
  // and attaches what comes back, so it has to answer fast and with a real
  // application/pdf - which is why reports are stored rather than rendered on
  // demand. The template must have been APPROVED with a document header for
  // this to be accepted at all.
  if (documentUrl) {
    components.push({
      type: 'header',
      parameters: [{
        type: 'document',
        document: { link: documentUrl, filename: documentName || 'report.pdf' }
      }]
    });
  }
  if (bodyParams && bodyParams.length) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(value => ({ type: 'text', text: String(value) }))
    });
  }
  if (buttonUrlSuffix) {
    components.push({
      type: 'button', sub_type: 'url', index: '0',
      parameters: [{ type: 'text', text: String(buttonUrlSuffix) }]
    });
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: template, language: { code: language() }, components }
  };
}

/** The flatter shape most non-Meta-shaped BSPs use. */
function simpleBody({ to, template, bodyParams, buttonUrlSuffix, text, documentUrl, documentName }) {
  if (text) return { from: sender(), to, type: 'text', message: text };
  return {
    from: sender(),
    to,
    type: 'template',
    template_name: template,
    language: language(),
    params: (bodyParams || []).map(String),
    button_params: buttonUrlSuffix ? [String(buttonUrlSuffix)] : undefined,
    header_document_url: documentUrl || undefined,
    header_document_name: documentUrl ? (documentName || 'report.pdf') : undefined
  };
}

/**
 * Uomox's real shape, taken directly from their own Postman docs. Everything
 * goes through one endpoint (broadcast/send-template) - there is no separate
 * free-text endpoint at all, template-based or not, which is why a bare
 * `text` (used for Divya's own alerts) cannot be sent through Uomox today;
 * see the comment on notifyOwner() in delivery.js.
 *
 * Confirmed against Uomox's docs: destination, templateName, templateParams,
 * an optional media header (their own example only shows type "image").
 * NOT confirmed by their docs, best-effort until tested against a real
 * approved template: a "document" media type for the PDF header, and the
 * exact shape of a dynamic URL button (their "Send Dynamic Button Url
 * Message" example is a copy-paste of the media example in their own docs
 * and does not actually show a button). Both are flagged below - test these
 * two specifically once a template using them is approved.
 */
function uomoxBody({ to, template, bodyParams, buttonUrlSuffix, documentUrl, documentName }) {
  const body = {
    destination: to,
    templateName: template,
    templateParams: (bodyParams || []).map(String),
    buttons: []
  };
  if (documentUrl) {
    // NOT CONFIRMED: Uomox's docs only demonstrate type "image". Meta's own
    // Cloud API uses "document" for a PDF header, which is the reasonable
    // guess here, but this specific line needs a live test once
    // blueprint_ready (the template with a document header) is approved.
    body.media = { url: documentUrl, type: 'document', filename: documentName || 'report.pdf' };
  }
  if (buttonUrlSuffix) {
    // NOT CONFIRMED: see the function comment above - Uomox's own example for
    // this is broken/duplicated, so this is a best guess pending a real test.
    body.buttons = [String(buttonUrlSuffix)];
  }
  return body;
}

/**
 * Sends, and is honest about what happened.
 *
 * A 2xx alone is not treated as delivered: BSPs return 200 with an error body
 * often enough that trusting the status code is how "it says it sent" and "the
 * customer got nothing" coexist for a week.
 */
async function send({ to, template, bodyParams, buttonUrlSuffix, text, documentUrl, documentName }) {
  if (!isConfigured()) return { sent: false, reason: 'not_configured' };

  const number = normalise(to);
  if (!number) return { sent: false, reason: 'no recipient' };
  if (!template && !text) return { sent: false, reason: 'nothing to send' };
  // Uomox has exactly one send endpoint and it is template-only - there is no
  // free-text send at all, not even inside the 24-hour reply window. A caller
  // asking for plain text (Divya's own owner alerts today) gets told why
  // instead of firing a request Uomox cannot honour.
  if (style() === 'uomox' && text && !template) {
    return { sent: false, reason: 'Uomox has no free-text endpoint - only approved templates can be sent' };
  }

  const build = style() === 'simple' ? simpleBody : style() === 'uomox' ? uomoxBody : cloudBody;
  const payload = build({ to: number, template, bodyParams, buttonUrlSuffix, text, documentUrl, documentName });

  // Meta's own URL carries the sender in the path; most wrappers do not.
  const url = baseUrl().includes('{sender}')
    ? baseUrl().replace('{sender}', encodeURIComponent(sender()))
    : baseUrl();

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : {}; } catch (e) { result = { raw }; }

  if (!response.ok) {
    const described = (result.error && (result.error.message || result.error.description)) ||
      result.message || `WhatsApp provider answered ${response.status}`;
    const error = new Error(described);
    error.status = response.status;
    error.provider = result;
    throw error;
  }

  // An explicit failure flag inside a 200, which several providers do. Uomox
  // answers {"status":"success",...} on a real send, so for that style
  // anything other than "success" is a failure too, not just "failed".
  const uomoxFailed = style() === 'uomox' && result.status && result.status !== 'success';
  if (result.error || result.success === false || result.status === 'failed' || uomoxFailed) {
    const error = new Error(
      (result.error && (result.error.message || result.error.description)) ||
      result.message || 'The WhatsApp provider rejected the message'
    );
    error.status = 200;
    error.provider = result;
    throw error;
  }

  const id = (result.metaResponse && result.metaResponse.messages && result.metaResponse.messages[0] &&
      result.metaResponse.messages[0].id) ||
    (result.messages && result.messages[0] && result.messages[0].id) ||
    result.message_id || result.id || '';
  return { sent: true, id, provider: result };
}

module.exports = { send, isConfigured, normalise, templateName, sender, style };
