// What Uomox posts back when a customer replies. Mounted at /api/whatsapp.
//
// This is the URL that goes in the empty "API Webhook URL" box in the Uomox
// dashboard, and until it is filled in there is no way for someone to stop
// receiving follow-ups. A marketing channel without a working opt-out is one
// complaint away from the number being blocked, so this is not optional
// plumbing - it is the thing that makes the follow-ups legitimate.
//
// It reads inbound messages for two purposes only: honouring "stop", and
// noting that the customer replied. It does not attempt to be a chatbot.

const express = require('express');
const campaigns = require('./services/campaigns');
const db = require('./database');

const router = express.Router();

// Deliberately broad, and matched on the whole message rather than inside it,
// so "please stop sending me these" counts and "I could not stop reading it"
// does not.
const STOP_WORDS = [
  'stop', 'stop promotions', 'unsubscribe', 'opt out', 'optout',
  'remove me', 'do not message', 'dont message', 'no more messages',
  'band karo', 'bandh karo', 'mat bhejo'
];

function looksLikeStop(text) {
  const cleaned = String(text || '').trim().toLowerCase().replace(/[.!,]+$/g, '');
  if (!cleaned) return false;
  if (STOP_WORDS.includes(cleaned)) return true;
  // A short message that is mostly a stop request, e.g. "please stop".
  return cleaned.length <= 40 && /\b(stop|unsubscribe|opt ?out)\b/.test(cleaned);
}

/**
 * Providers disagree about where the message lives in the payload, so this
 * looks in the places they collectively use rather than assuming one.
 */
function extract(payload) {
  const body = payload || {};

  // Meta Cloud API shape, which most BSPs forward unchanged.
  const entry = body.entry && body.entry[0];
  const change = entry && entry.changes && entry.changes[0];
  const value = change && change.value;
  const cloudMessage = value && value.messages && value.messages[0];

  if (cloudMessage) {
    return {
      from: cloudMessage.from || '',
      text: (cloudMessage.text && cloudMessage.text.body) ||
        (cloudMessage.button && cloudMessage.button.text) ||
        (cloudMessage.interactive && cloudMessage.interactive.button_reply &&
          cloudMessage.interactive.button_reply.title) || ''
    };
  }

  // Flatter shapes.
  return {
    from: body.from || body.sender || body.mobile || body.phone || body.wa_id || '',
    text: body.text || body.message || body.body ||
      (body.data && (body.data.text || body.data.message)) || ''
  };
}

/**
 * Always answers 200.
 *
 * A provider that gets an error retries, and a retry storm on an endpoint that
 * only records opt-outs helps nobody. Real problems go to the log.
 */
router.post('/inbound', async (req, res) => {
  try {
    // A shared secret, when the provider supports one. Checked only if set, so
    // configuring the webhook does not have to wait on it.
    const expected = process.env.UOMOX_WEBHOOK_SECRET || '';
    if (expected) {
      const supplied = req.get('x-webhook-secret') || req.query.secret || '';
      if (supplied !== expected) {
        console.error('[whatsapp:inbound] rejected: bad secret');
        return res.status(401).json({ ok: false });
      }
    }

    const { from, text } = extract(req.body);
    if (!from) return res.json({ ok: true, ignored: 'no sender' });

    if (looksLikeStop(text)) {
      const result = await campaigns.optOut({ phone: from, via: 'whatsapp' });
      console.log(`[whatsapp:inbound] opt-out from ${String(from).slice(-4)}, ${result.opted_out} lead(s)`);
      return res.json({ ok: true, opted_out: result.opted_out });
    }

    // Any other reply opens WhatsApp's 24-hour window, which is worth knowing:
    // inside it Divya can write to them freely, with no template at all.
    try {
      const digits = String(from).replace(/\D/g, '').slice(-10);
      const candidates = await db.getLeads({ search: digits });
      const match = candidates.find(lead =>
        String(lead.normalized_phone || lead.phone || '').replace(/\D/g, '').slice(-10) === digits);
      if (match) await db.updateLead(match.id, { last_activity_at: new Date().toISOString() });
    } catch (error) {
      console.error('[whatsapp:inbound] could not note the reply:', error.message);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[whatsapp:inbound]', error);
    return res.json({ ok: true });
  }
});

/**
 * Meta's verification handshake, which several BSPs proxy. Harmless if unused.
 */
router.get('/inbound', (req, res) => {
  const token = process.env.UOMOX_VERIFY_TOKEN || '';
  if (token && req.query['hub.verify_token'] === token) {
    return res.status(200).send(String(req.query['hub.challenge'] || ''));
  }
  return res.status(200).json({ ok: true });
});

module.exports = router;
module.exports.looksLikeStop = looksLikeStop;
module.exports.extract = extract;
