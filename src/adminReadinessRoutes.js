// One page that answers "is this ready to go live, and if not, what is stopping
// it". Mounted at /api/admin/readiness behind adminAuth.
//
// Everything it reports was already knowable, but only by opening three
// different endpoints and knowing what each field meant. Going live is stressful
// enough without that, so this asks every provider directly, in parallel, and
// answers in sentences: what works, what does not, and the single next thing to
// do about it.
//
// It never guesses from a variable being present. Razorpay and Resend are both
// asked whether they actually accept the credentials, because "the key is set"
// and "the key works" have already been two different things here.

const express = require('express');
const razorpay = require('./services/razorpay');
const whatsapp = require('./services/transports/whatsapp');
const email = require('./services/transports/email');
const delivery = require('./services/delivery');
const reportStorage = require('./services/reportStorage');
const db = require('./database');

const router = express.Router();

function check(name, ok, detail, fix) {
  return { name, ok, detail, fix: ok ? null : fix };
}

async function razorpayCheck() {
  if (!razorpay.isConfigured()) {
    return check('Card payments', false,
      'No Razorpay keys on this deployment. Customers are sent to WhatsApp instead.',
      'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel, then redeploy.');
  }
  try {
    await razorpay.ping();
    const live = razorpay.isLiveMode();
    return check('Card payments', true,
      live ? 'Connected in LIVE mode. Real cards are charged.'
           : 'Connected in TEST mode. Test cards work; a real card will be declined.',
      null);
  } catch (error) {
    if (error.status === 401) {
      return check('Card payments', false,
        'Razorpay is rejecting the keys (401). Payments cannot be taken.',
        'The key id and secret are from different keypairs, or the secret is wrong. In Razorpay, Settings > API Keys > Regenerate, copy BOTH halves from the same dialog, paste both into Vercel, redeploy.');
    }
    return check('Card payments', false,
      `Razorpay could not be reached: ${error.message}`,
      'Check the Razorpay status page, then try again.');
  }
}

async function emailCheck() {
  if (!email.isConfigured()) {
    return check('Email', false,
      'No email provider. Reports are not emailed to anyone.',
      'Sign up at resend.com, verify divyabajaj.com, then set RESEND_API_KEY and MAIL_FROM in Vercel.');
  }
  if (email.isSandboxSender()) {
    return check('Email', false,
      'Sending from Resend\'s shared address, which only reaches your own inbox. Customers get nothing.',
      'Verify divyabajaj.com in Resend, then set MAIL_FROM to an address on that domain.');
  }
  try {
    const { domains } = await email.ping();
    const verified = (domains || []).filter(d => d.status === 'verified').map(d => d.name);
    if (!verified.length) {
      return check('Email', false,
        'Resend accepts the key but no domain is verified, so delivery will be blocked or land in spam.',
        'In Resend, add divyabajaj.com and put the DNS records it gives you into GoDaddy.');
    }
    return check('Email', true, `Connected and sending from ${email.from()}.`, null);
  } catch (error) {
    return check('Email', false,
      error.status === 401 ? 'Resend is rejecting the API key.' : `Resend could not be reached: ${error.message}`,
      'Generate a new API key in Resend and set RESEND_API_KEY in Vercel.');
  }
}

function whatsappCheck() {
  if (!whatsapp.isConfigured()) {
    return check('WhatsApp', false,
      'Not connected. Reports and confirmations are not sent on WhatsApp.',
      'Set UOMOX_API_URL (the send-message endpoint), UOMOX_API_KEY and UOMOX_SENDER in Vercel.');
  }
  return check('WhatsApp', true,
    `Connected, sending from ${whatsapp.sender()}. A template Meta has not approved will still fail per message, and each failure shows against that customer in Reports.`,
    null);
}

function webhookCheck() {
  const ok = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
  return check('Payment webhook', ok,
    ok ? 'Set. A customer who pays and closes the tab still gets their report.'
       : 'Not set. If a customer pays and closes the tab, nothing tells the site, and their report is not built until you press Retry.',
    'In Razorpay, Settings > Webhooks, add https://divyabajaj.com/api/booking/payment/webhook with events payment.captured and order.paid, and put the same secret in RAZORPAY_WEBHOOK_SECRET.');
}

function cronCheck() {
  const ok = Boolean(process.env.CRON_SECRET);
  return check('Retry and refund job', ok,
    ok ? 'Set. Failed reports retry automatically and refund if they cannot be built.'
       : 'Not set, so the safety net is off. A report that fails is not retried and not refunded until you act.',
    'Add CRON_SECRET in Vercel (any long random string), then add a Vercel Cron Job hitting /api/internal/report-sweep every 5 minutes.');
}

function storageCheck() {
  const ok = reportStorage.isConfigured();
  return check('Report storage', ok,
    ok ? 'Working. Finished PDFs are stored, so WhatsApp can attach them.'
       : 'Not available, so a PDF is rebuilt on every request. WhatsApp attachments will time out.',
    'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel.');
}

function ownerCheck() {
  const phone = Boolean(delivery.ownerPhone());
  const mail = Boolean(delivery.ownerEmail());
  return check('Divya gets told', phone || mail,
    phone || mail
      ? `Alerts go to ${[phone ? 'WhatsApp' : null, mail ? 'email' : null].filter(Boolean).join(' and ')}.`
      : 'Divya is not alerted anywhere when something sells. She would have to watch the panel.',
    'Set OWNER_WHATSAPP and OWNER_EMAIL in Vercel.');
}

function storageModeCheck() {
  const ok = db.usingSupabase();
  return check('Database', ok,
    ok ? 'Connected.' : 'Running on local fallback storage. Customer data will be lost.',
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.');
}

router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const [payments, mail] = await Promise.all([razorpayCheck(), emailCheck()]);
    const checks = [
      storageModeCheck(),
      payments,
      webhookCheck(),
      storageCheck(),
      whatsappCheck(),
      mail,
      ownerCheck(),
      cronCheck()
    ];

    const blocking = checks.filter(c => !c.ok);
    const mode = razorpay.isConfigured() && razorpay.isLiveMode() ? 'live' : 'test';

    // Deliberately conservative about what "ready" means. Taking real money
    // needs the database, a working gateway IN LIVE MODE, and the webhook -
    // without the webhook a customer can pay and get nothing.
    const canTakeRealMoney = Boolean(
      db.usingSupabase() && payments.ok && mode === 'live' && process.env.RAZORPAY_WEBHOOK_SECRET
    );

    return res.json({
      ready_to_take_real_money: canTakeRealMoney,
      razorpay_mode: razorpay.isConfigured() ? mode : 'not configured',
      can_message_customers: delivery.isConfigured(),
      next_thing_to_do: blocking.length ? `${blocking[0].name}: ${blocking[0].fix}` : 'Nothing. Everything checked is working.',
      working: checks.filter(c => c.ok).map(c => `${c.name} - ${c.detail}`),
      blocking: blocking.map(c => ({ what: c.name, why: c.detail, fix: c.fix })),
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[readiness]', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
