const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const { adminAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', adminAuth, routes);
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.use('/admin', adminAuth, express.static(publicDir));
app.use(express.static(publicDir));

app.get('/', (req, res) => {
  const landingPath = path.join(publicDir, 'landing.html');
  if (!fs.existsSync(landingPath)) return res.status(404).send('Landing page not found');
  let html = fs.readFileSync(landingPath, 'utf8');
  const scriptTag = '<script src="/flow-fix.js"></script>';
  html = html.includes('</body>') ? html.replace('</body>', scriptTag + '</body>') : html + scriptTag;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Divya Bajaj Backend System running on ${PORT}`));
}

module.exports = app;
