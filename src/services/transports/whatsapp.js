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
//   cloud  - Meta's Cloud API JSON, which most BSPs pass straight through
//   simple - a flat {to, template, params} body, which the rest tend to use
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
function style() { return (process.env.UOMOX_API_STYLE || 'cloud').toLowerCase(); }

function templateName(key) {
  const map = {
    report_ready: process.env.UOMOX_TEMPLATE_REPORT_READY || 'blueprint_ready',
    consultation_confirmed: process.env.UOMOX_TEMPLATE_CONSULTATION || 'consultation_confirmed'
  };
  return map[key] || key;
}

function language() { return process.env.UOMOX_TEMPLATE_LANG || 'en'; }

function isConfigured() {
  return Boolean(baseUrl() && apiKey() && sender());
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
function cloudBody({ to, template, bodyParams, buttonUrlSuffix, text }) {
  if (text) {
    return { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
  }

  const components = [];
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
function simpleBody({ to, template, bodyParams, buttonUrlSuffix, text }) {
  if (text) return { from: sender(), to, type: 'text', message: text };
  return {
    from: sender(),
    to,
    type: 'template',
    template_name: template,
    language: language(),
    params: (bodyParams || []).map(String),
    button_params: buttonUrlSuffix ? [String(buttonUrlSuffix)] : undefined
  };
}

/**
 * Sends, and is honest about what happened.
 *
 * A 2xx alone is not treated as delivered: BSPs return 200 with an error body
 * often enough that trusting the status code is how "it says it sent" and "the
 * customer got nothing" coexist for a week.
 */
async function send({ to, template, bodyParams, buttonUrlSuffix, text }) {
  if (!isConfigured()) return { sent: false, reason: 'not_configured' };

  const number = normalise(to);
  if (!number) return { sent: false, reason: 'no recipient' };
  if (!template && !text) return { sent: false, reason: 'nothing to send' };

  const build = style() === 'simple' ? simpleBody : cloudBody;
  const payload = build({ to: number, template, bodyParams, buttonUrlSuffix, text });

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

  // An explicit failure flag inside a 200, which several providers do.
  if (result.error || result.success === false || result.status === 'failed') {
    const error = new Error(
      (result.error && (result.error.message || result.error.description)) ||
      result.message || 'The WhatsApp provider rejected the message'
    );
    error.status = 200;
    error.provider = result;
    throw error;
  }

  const id = (result.messages && result.messages[0] && result.messages[0].id) ||
    result.message_id || result.id || '';
  return { sent: true, id, provider: result };
}

module.exports = { send, isConfigured, normalise, templateName, sender, style };
