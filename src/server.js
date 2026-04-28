const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { adminAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', adminAuth, routes);
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use('/admin', adminAuth, express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => res.redirect('/admin'));

if (require.main === module) {
  app.listen(PORT, () => console.log(`Divya Bajaj Backend System running on ${PORT}`));
}

module.exports = app;
