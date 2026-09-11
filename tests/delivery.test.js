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

test('the WhatsApp template gets numbered blanks, not a sentence', () => {
  const vars = messages.reportReadyWhatsapp({ name: 'Ananya Rao', reportToken: 'abc123' });
  assert.deepStrictEqual(vars.body, ['Ananya']);
  assert.strictEqual(vars.buttonUrlSuffix, 'abc123');
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

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
