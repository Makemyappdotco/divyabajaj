// Delivery: links, message content, and the two transports.
//
// The failure this guards against is the quiet one. A WhatsApp provider that
// answers 200 to a body it did not understand, or a Resend sender still on the
// shared sandbox domain, both look exactly like a working integration until a
// customer says they got nothing. So the assertions here are mostly about
// refusing to call something a success.

const assert = require('assert');
const http = require('http');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) {
  queue.push(async () => {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
  });
}

process.env.REPORT_DOWNLOAD_SECRET = 'test-signing-secret-not-a-real-one';
process.env.SITE_URL = 'https://divyabajaj.com';

const reportLinks = require('../src/services/reportLinks');
const messages = require('../src/services/messages');

/** A stand-in provider, so nothing leaves this machine. */
function fakeProvider(handler) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => handler(req, res, body ? JSON.parse(body) : {}));
    }).listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/send` }));
  });
}

console.log('\ndelivery\n');

// ------------------------------------------------------------------ links

test('a report link is short enough for a WhatsApp button', () => {
  const url = reportLinks.url('rep_1234567890abcd');
  assert.ok(url.length < 140, `link is ${url.length} chars`);
  assert.ok(url.startsWith('https://divyabajaj.com/r/'));
});

test('a link round-trips to its report', () => {
  const token = reportLinks.token('rep_roundtrip');
  assert.strictEqual(reportLinks.verify(token), 'rep_roundtrip');
});

test('a tampered link is refused', () => {
  const token = reportLinks.token('rep_tamper');
  assert.strictEqual(reportLinks.verify(token.slice(0, -3) + 'AAA'), null);
  assert.strictEqual(reportLinks.verify('nonsense'), null);
  assert.strictEqual(reportLinks.verify(''), null);
});

test('an expired link is refused', () => {
  assert.strictEqual(reportLinks.verify(reportLinks.token('rep_old', -60)), null);
});

test('a link signed with another secret is refused', () => {
  const token = reportLinks.token('rep_secret');
  const original = process.env.REPORT_DOWNLOAD_SECRET;
  process.env.REPORT_DOWNLOAD_SECRET = 'a-different-secret';
  delete require.cache[require.resolve('../src/services/reportLinks')];
  const other = require('../src/services/reportLinks');
  const verdict = other.verify(token);
  process.env.REPORT_DOWNLOAD_SECRET = original;
  delete require.cache[require.resolve('../src/services/reportLinks')];
  assert.strictEqual(verdict, null);
});

// --------------------------------------------------------------- messages

test('the customer is addressed by first name, not their full name', () => {
  assert.strictEqual(messages.firstName('Ananya Rao Deshpande'), 'Ananya');
  assert.strictEqual(messages.firstName(''), 'there');
  assert.strictEqual(messages.firstName(null), 'there');
});

test('times are written in IST, whatever the server thinks', () => {
  // 06:00 UTC is 11:30 IST. A server in UTC must still say 11:30.
  const text = messages.inIst('2026-09-12T06:00:00.000Z');
  assert.ok(/11:30/.test(text), text);
  assert.ok(/IST$/.test(text), text);
});

test('the report email carries both a text and an HTML part', () => {
  const mail = messages.reportReadyEmail({ name: 'Ananya Rao', reportUrl: 'https://divyabajaj.com/r/abc' });
  assert.ok(mail.subject.length > 5);
  assert.ok(mail.text.includes('Hi Ananya'));
  assert.ok(mail.html.includes('Hi Ananya'));
  assert.ok(mail.html.includes('https://divyabajaj.com/r/abc'));
});

test('the email survives having no link, because the PDF is attached', () => {
  const mail = messages.reportReadyEmail({ name: 'Ananya', reportUrl: '' });
  assert.ok(!mail.text.includes('undefined'));
  assert.ok(!mail.html.includes('undefined'));
  assert.ok(mail.text.includes('attached'));
});

test('a name with HTML in it cannot break the email', () => {
  const mail = messages.reportReadyEmail({ name: '<script>alert(1)</script> Rao', reportUrl: '' });
  assert.ok(!mail.html.includes('<script>'), 'unescaped HTML reached the message');
});

test('the paid report WhatsApp template sends the greeting then the real report link, with no separate button field', () => {
  // Confirmed 2026-09-15 by reading blueprint_ready's own setup in Uomox:
  // Template Header is None (no document component, whatever the body text
  // says), and the button is https://divyabajaj.com/r/{{1}}. Same shape as
  // free_report_ready_new - the token has to be the second body value, not
  // a separate button field, or the button opens a placeholder link. This
  // was still on the old guessed shape (document header + button field),
  // which is what caused real, intermittent (#131008) failures in
  // production against paying customers.
  const vars = messages.reportReadyWhatsapp({ name: 'Ananya Rao', reportToken: 'abc123' });
  assert.deepStrictEqual(vars.body, ['Ananya', 'abc123']);
  assert.strictEqual(vars.buttonUrlSuffix, undefined, 'this provider has no separate button field - the token travels inside body');
});

test('a missing report token does not crash the paid report WhatsApp send', () => {
  const vars = messages.reportReadyWhatsapp({ name: 'Ananya Rao' });
  assert.deepStrictEqual(vars.body, ['Ananya', '']);
});

test('the free report WhatsApp template sends the greeting then the real report link, with no separate button field', () => {
  // Confirmed 2026-09-14 by reading the template's own button config in
  // Uomox: "View Report (URL https://divyabajaj.com/r/{{1}} (Example:
  // free-report.pdf))". Uomox flattens every component's blanks into one
  // array - body {{1}} first, then the button's {{1}} - so the token has to
  // be the second value here, not a separate buttons field, or the button
  // opens a placeholder link instead of this customer's real report.
  const vars = messages.freeReportWhatsapp({ name: 'Ananya Rao', reportToken: 'tok_abc123' });
  assert.deepStrictEqual(vars.body, ['Ananya', 'tok_abc123']);
  assert.strictEqual(vars.buttonUrlSuffix, undefined, 'this provider has no separate button field - the token travels inside body');
});

test('a missing report token does not crash the free report WhatsApp send', () => {
  const vars = messages.freeReportWhatsapp({ name: 'Ananya Rao' });
  assert.deepStrictEqual(vars.body, ['Ananya', '']);
});

test("Divya's alert carries what she needs to act", () => {
  const text = messages.ownerAlertWhatsapp({
    event: 'blueprint', name: 'Ananya Rao', phone: '9812345678',
    question: 'career direction', amountInr: 999
  });
  assert.ok(text.includes('Ananya Rao'));
  assert.ok(text.includes('9812345678'));
  assert.ok(text.includes('999'));
});

// -------------------------------------------------------- whatsapp transport

function loadWhatsapp(env) {
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../src/services/transports/whatsapp')];
  return require('../src/services/transports/whatsapp');
}

function clearWhatsappEnv() {
  ['UOMOX_API_URL', 'UOMOX_API_KEY', 'UOMOX_SENDER', 'UOMOX_API_STYLE',
   'UOMOX_AUTH_SCHEME', 'UOMOX_AUTH_HEADER'].forEach(k => { delete process.env[k]; });
}

test('Indian numbers are normalised to what Meta expects', () => {
  clearWhatsappEnv();
  const wa = loadWhatsapp({});
  assert.strictEqual(wa.normalise('9812345678'), '919812345678');
  assert.strictEqual(wa.normalise('09812345678'), '919812345678');
  assert.strictEqual(wa.normalise('+91 98123 45678'), '919812345678');
  assert.strictEqual(wa.normalise('919812345678'), '919812345678');
  assert.strictEqual(wa.normalise(''), '');
});

test('nothing is sent when the provider is not configured', async () => {
  clearWhatsappEnv();
  const wa = loadWhatsapp({});
  const result = await wa.send({ to: '9812345678', template: 'blueprint_ready', bodyParams: ['A'] });
  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.reason, 'not_configured');
});

test('the Cloud API shape is sent correctly', async () => {
  let seen = null;
  const { server, url } = await fakeProvider((req, res, body) => {
    seen = { headers: req.headers, body };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: [{ id: 'wamid.TEST' }] }));
  });

  const wa = loadWhatsapp({
    UOMOX_API_URL: url, UOMOX_API_KEY: 'secret-token',
    UOMOX_SENDER: '919545136766', UOMOX_API_STYLE: 'cloud'
  });
  const result = await wa.send({
    to: '9812345678', template: 'blueprint_ready',
    bodyParams: ['Ananya'], buttonUrlSuffix: 'abc123'
  });
  server.close();

  assert.strictEqual(result.sent, true);
  assert.strictEqual(result.id, 'wamid.TEST');
  assert.strictEqual(seen.headers.authorization, 'Bearer secret-token');
  assert.strictEqual(seen.body.messaging_product, 'whatsapp');
  assert.strictEqual(seen.body.to, '919812345678');
  assert.strictEqual(seen.body.template.name, 'blueprint_ready');

  const bodyComponent = seen.body.template.components.find(c => c.type === 'body');
  assert.deepStrictEqual(bodyComponent.parameters, [{ type: 'text', text: 'Ananya' }]);
  const button = seen.body.template.components.find(c => c.type === 'button');
  assert.strictEqual(button.parameters[0].text, 'abc123');
});

test('the flat shape is sent when the provider wants that instead', async () => {
  let seen = null;
  const { server, url } = await fakeProvider((req, res, body) => {
    seen = body;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message_id: 'msg_1' }));
  });

  const wa = loadWhatsapp({
    UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_SENDER: '919545136766',
    UOMOX_API_STYLE: 'simple'
  });
  const result = await wa.send({ to: '9812345678', template: 'blueprint_ready', bodyParams: ['Ananya'] });
  server.close();

  assert.strictEqual(result.sent, true);
  assert.strictEqual(seen.template_name, 'blueprint_ready');
  assert.deepStrictEqual(seen.params, ['Ananya']);
});

test('the Uomox shape (the provider actually in use) is sent correctly, with no sender required', async () => {
  let seen = null;
  const { server, url } = await fakeProvider((req, res, body) => {
    seen = { headers: req.headers, body };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'success', message: 'Template message sent successfully.',
      metaResponse: { messaging_product: 'whatsapp', messages: [{ id: 'wamid.UOMOXTEST', message_status: 'accepted' }] }
    }));
  });

  // Deliberately no UOMOX_SENDER - Uomox ties the number to the token, not
  // to anything in the request, so this must still count as configured.
  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'secret-token', UOMOX_API_STYLE: 'uomox' });
  assert.strictEqual(wa.isConfigured(), true, 'Uomox should not require a sender to be considered configured');

  const result = await wa.send({
    to: '9812345678', template: 'payment_received', bodyParams: ['Ananya', '999']
  });
  server.close();

  assert.strictEqual(result.sent, true);
  assert.strictEqual(result.id, 'wamid.UOMOXTEST');
  assert.strictEqual(seen.headers.authorization, 'Bearer secret-token');
  assert.strictEqual(seen.body.destination, '919812345678');
  assert.strictEqual(seen.body.templateName, 'payment_received');
  assert.deepStrictEqual(seen.body.templateParams, ['Ananya', '999']);
  assert.deepStrictEqual(seen.body.buttons, []);
});

test('uomox is the default style, since it is the provider actually in use', () => {
  const wa = loadWhatsapp({ UOMOX_API_URL: 'http://example.invalid', UOMOX_API_KEY: 'k' });
  assert.strictEqual(wa.style(), 'uomox');
});

test('Uomox has no free-text send, so an owner alert (plain text, no template) is skipped, not attempted', async () => {
  let called = false;
  const { server, url } = await fakeProvider((req, res) => {
    called = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success' }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_API_STYLE: 'uomox' });
  const result = await wa.send({ to: '9812345678', text: 'Ananya just paid ₹999' });
  server.close();

  assert.strictEqual(called, false, 'a free-text send should never reach the provider for Uomox');
  assert.strictEqual(result.sent, false);
  assert.ok(/free-text/.test(result.reason), result.reason);
});

test('Uomox answering anything other than "success" is treated as a failure, not just "failed"', async () => {
  const { server, url } = await fakeProvider((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Template not approved for this account' }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_API_STYLE: 'uomox' });
  await assert.rejects(
    () => wa.send({ to: '9812345678', template: 'x', bodyParams: [] }),
    /Template not approved for this account/
  );
  server.close();
});

test('a document header for Uomox carries the report PDF link', async () => {
  let seen = null;
  const { server, url } = await fakeProvider((req, res, body) => {
    seen = body;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', metaResponse: { messages: [{ id: 'wamid.DOC' }] } }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_API_STYLE: 'uomox' });
  await wa.send({
    to: '9812345678', template: 'blueprint_ready', bodyParams: ['Ananya'],
    documentUrl: 'https://example.com/report.pdf', documentName: 'Divya-Bajaj-Full-Blueprint.pdf'
  });
  server.close();

  assert.strictEqual(seen.media.url, 'https://example.com/report.pdf');
  assert.strictEqual(seen.media.filename, 'Divya-Bajaj-Full-Blueprint.pdf');
});

test('an image header for Uomox carries the header image, in the confirmed type "image" shape', async () => {
  // Divya's team uploaded a static banner as the header when free_report_ready_new
  // was approved, so WhatsApp expects that same image resent with every message -
  // this is the fix for the real "Media upload error" customers saw.
  let seen = null;
  const { server, url } = await fakeProvider((req, res, body) => {
    seen = body;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', metaResponse: { messages: [{ id: 'wamid.IMG' }] } }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_API_STYLE: 'uomox' });
  await wa.send({
    to: '9812345678', template: 'free_report_ready_new', bodyParams: ['Ananya', 'tok_abc'],
    imageUrl: 'https://divyabajaj.com/whatsapp/free-report-ready.png'
  });
  server.close();

  assert.strictEqual(seen.media.url, 'https://divyabajaj.com/whatsapp/free-report-ready.png');
  assert.strictEqual(seen.media.type, 'image');
  assert.ok(!seen.media.filename, 'an image header has no filename, that is a document-header-only field');
});

test('a document header wins over an image header if a caller somehow sends both', async () => {
  // Never happens today (no caller passes both), but the PDF is the one that
  // has to win if it ever does - it is the actual deliverable.
  let seen = null;
  const { server, url } = await fakeProvider((req, res, body) => {
    seen = body;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success' }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_API_STYLE: 'uomox' });
  await wa.send({
    to: '9812345678', template: 'blueprint_ready', bodyParams: ['Ananya'],
    documentUrl: 'https://example.com/report.pdf', imageUrl: 'https://example.com/banner.png'
  });
  server.close();

  assert.strictEqual(seen.media.type, 'document');
  assert.strictEqual(seen.media.url, 'https://example.com/report.pdf');
});

test('deliverFreeReport sends the free-reading header image, from SITE_URL', () => {
  // Not sending this at all is exactly what was producing the "Media upload
  // error" - see the long comment on the imageUrl line in deliverFreeReport.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'delivery.js'), 'utf8');
  const fn = source.slice(source.indexOf('async function deliverFreeReport'), source.indexOf('async function notifyPaymentReceived'));

  assert.ok(/imageUrl:\s*`\$\{reportLinks\.siteUrl\(\)\}\/whatsapp\/free-report-ready\.png`/.test(fn),
    'deliverFreeReport should send imageUrl built from reportLinks.siteUrl(), not a hardcoded domain');

  const imagePath = path.join(__dirname, '..', 'public', 'whatsapp', 'free-report-ready.png');
  assert.ok(fs.existsSync(imagePath), 'the image the code points at should actually exist in public/whatsapp/');
});

test('a 200 that carries an error is NOT called a success', async () => {
  const { server, url } = await fakeProvider((req, res) => {
    // Exactly what several providers do, and the reason status codes alone
    // are not trusted here.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Template not approved' }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_SENDER: '91', UOMOX_API_STYLE: 'cloud' });
  await assert.rejects(
    () => wa.send({ to: '9812345678', template: 'x', bodyParams: [] }),
    /Template not approved/
  );
  server.close();
});

test('a provider error is reported with what it actually said', async () => {
  const { server, url } = await fakeProvider((req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Recipient not on WhatsApp' } }));
  });

  const wa = loadWhatsapp({ UOMOX_API_URL: url, UOMOX_API_KEY: 'k', UOMOX_SENDER: '91', UOMOX_API_STYLE: 'cloud' });
  await assert.rejects(
    () => wa.send({ to: '9812345678', template: 'x', bodyParams: [] }),
    /Recipient not on WhatsApp/
  );
  server.close();
});

// ----------------------------------------------------------- email transport

function loadEmail(env) {
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../src/services/transports/email')];
  return require('../src/services/transports/email');
}

test('email is not configured without both a key and a from address', () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.MAIL_FROM;
  assert.strictEqual(loadEmail({}).isConfigured(), false);
  assert.strictEqual(loadEmail({ RESEND_API_KEY: 'k' }).isConfigured(), false);
  assert.strictEqual(loadEmail({ MAIL_FROM: 'a@b.com' }).isConfigured(), true);
});

test('the shared Resend sender is flagged, because it cannot reach customers', () => {
  const mail = loadEmail({ RESEND_API_KEY: 'k', MAIL_FROM: 'onboarding@resend.dev' });
  assert.strictEqual(mail.isSandboxSender(), true);
  const real = loadEmail({ RESEND_API_KEY: 'k', MAIL_FROM: 'Divya <hello@divyabajaj.com>' });
  assert.strictEqual(real.isSandboxSender(), false);
});

test('the PDF goes as a base64 attachment', async () => {
  let seen = null;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      seen = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'email_1' }));
    });
  });
  await new Promise(r => server.listen(0, r));

  // Point the transport at the stand-in by rewriting fetch for this one call.
  const realFetch = global.fetch;
  const port = server.address().port;
  global.fetch = (url, options) => realFetch(`http://127.0.0.1:${port}/`, options);

  const mail = loadEmail({ RESEND_API_KEY: 'k', MAIL_FROM: 'Divya <hello@divyabajaj.com>' });
  const result = await mail.send({
    to: 'a@b.com', subject: 'S', text: 'T', html: '<p>T</p>',
    attachment: { filename: 'r.pdf', content: Buffer.from('%PDF-1.4 hello') }
  });

  global.fetch = realFetch;
  server.close();

  assert.strictEqual(result.sent, true);
  assert.strictEqual(seen.attachments.length, 1);
  assert.strictEqual(seen.attachments[0].filename, 'r.pdf');
  assert.strictEqual(Buffer.from(seen.attachments[0].content, 'base64').toString(), '%PDF-1.4 hello');
});

test('the free report now points at the Utility-approved template, not the Marketing one', () => {
  // free_report_ready (Marketing) accepted sends and returned real message
  // IDs while never actually reaching a phone that had not opted in to
  // marketing messages - confirmed against real delivery_attempts rows on
  // 2026-09-14. free_report_ready_new is the same content, approved as
  // Utility instead, which does not carry that restriction.
  delete process.env.UOMOX_TEMPLATE_FREE_REPORT;
  delete require.cache[require.resolve('../src/services/transports/whatsapp')];
  const wa = require('../src/services/transports/whatsapp');
  assert.strictEqual(wa.templateName('free_report_ready'), 'free_report_ready_new');
});

test('deliverFreeReport does not send a document header or a separate button field', () => {
  // This template has no document-header component, and this provider has
  // no separate button field - the real report link travels inside
  // bodyParams (see freeReportWhatsapp() in messages.js). Sending either of
  // these would trip (#131008) Required parameter is missing again.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'delivery.js'), 'utf8');
  const fn = source.slice(source.indexOf('async function deliverFreeReport'), source.indexOf('async function notifyPaymentReceived'));

  assert.ok(!fn.includes('buttonUrlSuffix'), 'deliverFreeReport should not send button data for free_report_ready');
  assert.ok(!fn.includes('documentUrl'), 'deliverFreeReport should not send a document header for free_report_ready');
});

test('deliverReport (the paid blueprint) does not send a document header or a separate button field either', () => {
  // Same bug, same template family: blueprint_ready has no document header
  // (Template Header: None in Uomox) and its button is filled from the
  // flat array, not a separate field. This was left on the old guessed
  // shape after the free report fix, on purpose, until it could be
  // confirmed - it is now confirmed, and this is the regression guard.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'delivery.js'), 'utf8');
  const fn = source.slice(source.indexOf('async function deliverReport'), source.indexOf('async function deliverFreeReport'));

  assert.ok(!fn.includes('buttonUrlSuffix'), 'deliverReport should not send button data for report_ready/blueprint_ready');
  assert.ok(!fn.includes('documentUrl'), 'deliverReport should not send a document header for report_ready/blueprint_ready');
});

// -------------------------------------------------- failure diagnostics

test('a failed send keeps the provider\'s raw response, not just its message', () => {
  // attempt()'s catch block used to store only error.message, which is why a
  // guessed Uomox request shape (see uomoxBody() in transports/whatsapp.js)
  // could not be diagnosed from delivery_attempts alone - only "Required
  // parameter is missing" ever showed up, never which field. Both the
  // record() call and the console.error must carry error.provider now.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'delivery.js'), 'utf8');
  const catchBlock = source.slice(source.indexOf('async function attempt'), source.indexOf('// ------------------------------------------------------------ the report'));

  assert.ok(catchBlock.includes('error.provider'), 'the catch block should reference error.provider');
  assert.ok(/detail:\s*error\.message\s*\+\s*raw/.test(catchBlock), 'record() should be given message + the raw provider detail');
  assert.ok(/console\.error\([^)]*error\.provider/.test(catchBlock), 'the console log should also carry error.provider for Vercel logs');
});

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
