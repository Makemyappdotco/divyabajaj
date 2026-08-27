require('../src/services/locationSearchUpgrade')();
const app = require('../src/server.js');
const pdfV4Preview = require('./pdf-layout-v4-preview');

module.exports = async function handler(req, res) {
  const requestPath = String(req.url || '').split('?')[0];
  if (req.method === 'GET' && requestPath === '/api/pdf-layout-v4-preview') {
    return pdfV4Preview(req, res);
  }
  return app(req, res);
};
