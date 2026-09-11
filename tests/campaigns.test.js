// Follow-up messages: consent, suppression, and opting out.
//
// This is the only code in the system that sends something nobody asked for,
// and a promotional message cannot be recalled. So these tests are almost all
// about the brakes: that consent is never inferred, that a sweep running twice
// cannot send twice, and that "stop" actually stops.

const assert = require('assert');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) {
  queue.push(async () => {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
  });
}

const inbound = require('../src/whatsappInboundRoutes');
const messages = require('../src/services/messages');
const campaigns = require('../src/services/campaigns');

console.log('\nfollow-up campaigns\n');

// -------------------------------------------------------------- opting out

test('plain stop words opt someone out', () => {
  ['stop', 'STOP', 'Stop.', 'unsubscribe', 'opt out', 'please stop', 'remove me']
    .forEach(text => assert.ok(inbound.looksLikeStop(text), `missed: ${text}`));
});

test('Hindi stop words opt someone out', () => {
  ['band karo', 'Bandh karo', 'mat bhejo']
    .forEach(text => assert.ok(inbound.looksLikeStop(text), `missed: ${text}`));
});

test('a sentence that merely contains "stop" does not', () => {
  [
    'I could not stop reading it, it was great',
    'Thank you, this helped me stop worrying about the job',
    'when does the dasha stop being difficult for me',
    ''
  ].forEach(text => assert.ok(!inbound.looksLikeStop(text), `false positive: ${text}`));
});

test('a reply is read from the Cloud API shape', () => {
  const parsed = inbound.extract({
    entry: [{ changes: [{ value: { messages: [{ from: '919812345678', text: { body: 'STOP' } }] } }] }]
  });
  assert.strictEqual(parsed.from, '919812345678');
  assert.strictEqual(parsed.text, 'STOP');
});

test('a reply is read from a flat provider shape', () => {
  const parsed = inbound.extract({ from: '919812345678', message: 'unsubscribe' });
  assert.strictEqual(parsed.from, '919812345678');
  assert.strictEqual(parsed.text, 'unsubscribe');
});

test('tapping the opt-out button counts, not just typing', () => {
  const parsed = inbound.extract({
    entry: [{ changes: [{ value: { messages: [{ from: '91981', button: { text: 'Stop these messages' } }] } }] }]
  });
  assert.ok(inbound.looksLikeStop(parsed.text), 'button text should opt out');
});

// ------------------------------------------------------------------ copy

test('every campaign has copy, and every copy has a campaign', () => {
  const defined = Object.keys(campaigns.CAMPAIGNS).sort();
  const written = Object.keys(messages.CAMPAIGN_COPY).sort();
  assert.deepStrictEqual(written, defined,
    `campaigns and copy disagree:\n  campaigns: ${defined}\n  copy:      ${written}`);
});

test('every follow-up email carries a way to stop', () => {
  Object.keys(messages.CAMPAIGN_COPY).forEach(campaign => {
    const mail = messages.campaignEmail(campaign, { name: 'Ananya Rao' });
    assert.ok(/STOP/i.test(mail.text), `${campaign}: no opt-out in the text part`);
    assert.ok(/STOP/i.test(mail.html), `${campaign}: no opt-out in the HTML part`);
  });
});

test('follow-ups address people by first name and escape it', () => {
  const mail = messages.campaignEmail('free_to_blueprint_1', { name: '<b>Ananya</b> Rao' });
  assert.ok(!mail.html.includes('<b>Ananya</b>'), 'unescaped name reached the HTML');
});

test('an unknown campaign is an error, never an empty message', () => {
  assert.throws(() => messages.campaignEmail('not_a_campaign', { name: 'A' }));
  assert.throws(() => messages.campaignWhatsapp('not_a_campaign', { name: 'A' }));
});

test('the WhatsApp side sends blanks, never a composed sentence', () => {
  const vars = messages.campaignWhatsapp('blueprint_to_consultation', { name: 'Ananya Rao' });
  assert.deepStrictEqual(vars.body, ['Ananya']);
});

// --------------------------------------------------------------- sequence

test('the second free follow-up requires the first', () => {
  assert.strictEqual(campaigns.CAMPAIGNS.free_to_blueprint_2.after, 'free_to_blueprint_1');
  assert.ok(!campaigns.CAMPAIGNS.free_to_blueprint_1.after, 'the first should not require anything');
});

test('follow-ups are spaced, and the last one comes last', () => {
  const first = campaigns.CAMPAIGNS.free_to_blueprint_1.delayHours;
  const second = campaigns.CAMPAIGNS.free_to_blueprint_2.delayHours;
  assert.ok(second > first, `second (${second}h) should come after first (${first}h)`);
  assert.ok(first >= 12, 'a follow-up within half a day of the free report is too soon');
});

test('there is a quiet period between any two follow-ups', () => {
  assert.ok(campaigns.QUIET_HOURS >= 24,
    `quiet period is ${campaigns.QUIET_HOURS}h; two promotions in a day is how people unsubscribe`);
});

test('nothing is chased forever', () => {
  assert.ok(campaigns.MAX_AGE_HOURS <= 30 * 24,
    'following up on something older than a month reads as a mailing list');
});

test('every campaign names a template that can be overridden', () => {
  const whatsapp = require('../src/services/transports/whatsapp');
  Object.entries(campaigns.CAMPAIGNS).forEach(([name, spec]) => {
    assert.ok(spec.template, `${name} has no template`);
    assert.strictEqual(typeof whatsapp.templateName(spec.template), 'string');
  });
});

// ------------------------------------------------------------ consent code

test('consent is granted only by a literal true', () => {
  const blueprint = require('../src/services/paidBlueprint');
  [true].forEach(value => {
    assert.strictEqual(blueprint.normalisePayload({ marketing_consent: value }).marketing_consent, true);
  });
  // Everything a browser might plausibly send that is NOT a ticked box.
  ['true', 1, 'on', 'yes', {}, [], 'false', 0, null, undefined, ''].forEach(value => {
    assert.strictEqual(
      blueprint.normalisePayload({ marketing_consent: value }).marketing_consent, false,
      `${JSON.stringify(value)} was treated as consent`
    );
  });
});

test('the consent box is never pre-ticked in either form', () => {
  const fs = require('fs');
  const path = require('path');
  ['booking-modal.js', 'paid-live-flow.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
    const consentInput = source.match(/<input type="checkbox" id="db[mp]Consent"[^>]*>/);
    assert.ok(consentInput, `${file}: no consent checkbox found`);
    assert.ok(!/checked/.test(consentInput[0]),
      `${file}: the consent box is pre-ticked, which Meta does not accept as opt-in`);
  });
});

test('consent is asked for in both forms, in plain words', () => {
  const fs = require('fs');
  const path = require('path');
  ['booking-modal.js', 'paid-live-flow.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
    assert.ok(/STOP/.test(source), `${file}: the consent text does not say how to stop`);
  });
});

test('the booking route no longer asserts consent nobody gave', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'bookingRoutes.js'), 'utf8');

  assert.ok(/marketing_consent\s*===\s*true/.test(source),
    'consent is not read from the request as a strict true');

  // The point is not that the literal never appears - it has to, to grant
  // consent - but that every place it appears is behind a check on what the
  // customer actually sent. An unguarded one is the bug this replaced.
  const occurrences = source.split(/marketing_consent:\s*true/).length - 1;
  assert.ok(occurrences >= 1, 'consent is never granted at all');

  source.split('\n').forEach((line, index) => {
    if (!/marketing_consent:\s*true/.test(line)) return;
    const preceding = source.split('\n').slice(Math.max(0, index - 4), index).join('\n');
    assert.ok(/marketingConsent\s*\?/.test(preceding) || /if\s*\(\s*marketingConsent/.test(preceding),
      `line ${index + 1} grants consent without checking the request:\n        ${line.trim()}`);
  });
});

test('consent is only ever granted by the lead writers, never revoked', () => {
  const fs = require('fs');
  const path = require('path');
  ['services/paidBlueprint.js', 'bookingRoutes.js', 'routes.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
    assert.ok(!/marketing_consent:\s*false/.test(source),
      `${file}: writes marketing_consent false, which would wipe an earlier opt-in`);
  });
});

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
