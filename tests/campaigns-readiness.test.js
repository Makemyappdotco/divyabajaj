// The readiness panel's "Follow-up messages" row - it has to read the exact
// same env var the real cron sweep reads (CAMPAIGNS_ENABLED === 'true'), or
// the panel could say ON while production is actually OFF, which is worse
// than not showing anything at all.
//
//   node tests/campaigns-readiness.test.js

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`ok - ${label}`); }
  else { failed++; console.error(`FAIL - ${label}`); }
}

function withEnv(value, fn) {
  const prior = process.env.CAMPAIGNS_ENABLED;
  if (value === undefined) delete process.env.CAMPAIGNS_ENABLED;
  else process.env.CAMPAIGNS_ENABLED = value;
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env.CAMPAIGNS_ENABLED;
    else process.env.CAMPAIGNS_ENABLED = prior;
  }
}

// require fresh each time isn't needed - campaignsCheck reads process.env live
// on every call, it does not cache anything at require time.
const readiness = require('../src/adminReadinessRoutes');

withEnv(undefined, () => {
  const result = readiness.campaignsCheck();
  check('unset env var reads as off', result.ok === false);
  check('off detail says nothing sends', /nothing sends until this is turned on/.test(result.detail));
  check('off gives the exact fix instruction', result.fix === 'Set CAMPAIGNS_ENABLED to true in Vercel, then redeploy.');
});

withEnv('false', () => {
  const result = readiness.campaignsCheck();
  check('the literal string "false" reads as off', result.ok === false);
});

withEnv('TRUE', () => {
  const result = readiness.campaignsCheck();
  check('anything other than exact lowercase "true" reads as off (matches the real gate in server.js)', result.ok === false);
});

withEnv('true', () => {
  const result = readiness.campaignsCheck();
  check('exact string "true" reads as on', result.ok === true);
  check('on detail names all 5 templates', /free reading to blueprint/.test(result.detail) &&
    /abandoned checkout/.test(result.detail) && /blueprint to consultation/.test(result.detail) &&
    /post-call/.test(result.detail));
  check('on check carries no fix (nothing to fix)', result.fix === null);
});

check('the check is named so it is recognisable in the panel, not a generic label', readiness.campaignsCheck().name === 'Follow-up messages');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
