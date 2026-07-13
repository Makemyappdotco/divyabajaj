const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
  const paidScript = '<script src="/paid-test-flow.js?v=paid-submit-fix-2"></script>';
  if (!html.includes('/paid-test-flow.js')) {
    html = html.replace('</body>', `${paidScript}\n</body>`);
  } else {
    html = html.replace(/<script src="\/paid-test-flow\.js[^>]*><\/script>/, paidScript);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
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