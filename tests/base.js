// One place for the harness address.
//
// These suites drifted onto four different hardcoded ports across sessions,
// and three of them were silently pointing at a server that no longer existed.
// Set BOOK_TEST_PORT to move them all at once.
const PORT = process.env.BOOK_TEST_PORT || '4409';

// The signature tests recompute Razorpay's HMACs, so they need the same
// secrets the harness runs with. These are the harness's throwaway values -
// never a real key, which is why they can sit in the repo. If the harness is
// started with different ones, export them before running the suite.
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'harness_secret_not_the_real_one';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'harness_webhook_secret';

module.exports = { PORT, BASE: `http://127.0.0.1:${PORT}` };
