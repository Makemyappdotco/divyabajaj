// Connect/disconnect flow for Divya's Google Calendar. Mounted at
// /api/admin/google-calendar behind adminAuth, ahead of the general
// /api/admin catch-all (server.js mounts specific routers before it).
//
// /connect and /callback are full-page navigations, not fetch() calls, so
// they ride on the browser's cached HTTP Basic Auth the same way any other
// /admin page load does - admin.html never has to attach a header itself.
//
// The environment (test/production) is threaded through the signed `state`
// param rather than trusted from a query string, so nothing on Google's side
// or in the redirect URL can point a connection at the wrong row.

const express = require('express');
const googleCalendar = require('./services/googleCalendar');
const store = require('./services/booking/store');

const router = express.Router();

router.get('/connect', (req, res) => {
  if (!googleCalendar.isConfigured()) {
    return res.redirect('/admin?gcal_error=' + encodeURIComponent('Google Calendar is not set up yet.'));
  }
  try {
    const environment = store.runtimeEnvironment();
    const state = googleCalendar.signState(environment);
    return res.redirect(googleCalendar.buildAuthUrl(state));
  } catch (error) {
    console.error('[google-calendar:connect]', error);
    return res.redirect('/admin?gcal_error=' + encodeURIComponent(error.message));
  }
});

router.get('/callback', async (req, res) => {
  const { code, state, error: googleError } = req.query;

  if (googleError) {
    // Most commonly "access_denied" - Divya backed out of the consent screen.
    return res.redirect('/admin?gcal_error=' + encodeURIComponent(
      googleError === 'access_denied' ? 'Connection cancelled.' : String(googleError)
    ));
  }

  const environment = googleCalendar.verifyState(state);
  if (!environment || !code) {
    return res.redirect('/admin?gcal_error=' + encodeURIComponent('That link expired. Try connecting again.'));
  }

  try {
    await googleCalendar.completeConnection({ environment, code: String(code) });
    return res.redirect('/admin?gcal_connected=1');
  } catch (error) {
    console.error('[google-calendar:callback]', error);
    return res.redirect('/admin?gcal_error=' + encodeURIComponent(error.message));
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    await googleCalendar.disconnect(store.runtimeEnvironment());
    return res.json({ ok: true });
  } catch (error) {
    console.error('[google-calendar:disconnect]', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
