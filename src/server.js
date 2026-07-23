const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Reuse the existing live AstrologyAPI credential until the V2 token is promoted to Production.
if (!process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN && process.env.ASTROLOGYAPI_ACCESS_TOKEN) {
  process.env.ASTROLOGYAPI_V2_ACCESS_TOKEN = process.env.ASTROLOGYAPI_ACCESS_TOKEN;
}

const routes = require('./routes');
const publicPaidRoutes = require('./publicPaidRoutes');
const { adminAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

function sendLandingWithPatches(res) {
  const landingPath = path.join(publicDir, 'landing.html');
  if (!fs.existsSync(landingPath)) return res.status(404).send('Landing page not found');

  let html = fs.readFileSync(landingPath, 'utf8');
  const paidScript = '<script src="/paid-live-flow.js?v=paid-live-ui-1"></script>';
  const polishScript = '<script src="/landing-live-polish.js?v=landing-polish-1"></script>';

  html = html.replace(/<script src="\/paid-test-flow\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-v2-live-conversion\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-live-flow\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/landing-live-polish\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-background-patch\.js[^>]*><\/script>/g, '');
  html = html.replace(/<script src="\/paid-fast-patch\.js[^>]*><\/script>/g, '');
  html = html.replace('</body>', `${paidScript}\n${polishScript}\n</body>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.send(html);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', publicPaidRoutes);
app.use('/api', adminAuth, routes);

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use('/admin', adminAuth, express.static(publicDir));
app.get('/', (req, res) => sendLandingWithPatches(res));
app.get('/landing.html', (req, res) => sendLandingWithPatches(res));
app.get('/consultation', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.sendFile(path.join(publicDir, 'consultation.html'));
});
app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  console.error('[Global server error]', err);
  if (res.headersSent) return next(err);

  const isApi = req.path.startsWith('/api');
  if (isApi) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Something went wrong while processing the request.'
    });
  }

  return res.status(err.status || 500).send('Something went wrong while loading the page.');
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Divya Bajaj Backend System running on ${PORT}`));
}

module.exports = app;
