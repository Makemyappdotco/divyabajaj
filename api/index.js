require('../src/services/locationSearchUpgrade')();
const app = require('../src/server.js');
const pdfLayoutV2Preview = require('./pdf-layout-v2-preview.js');

module.exports = async function handler(req, res) {
  const path = String(req.url || '').split('?')[0];
  if (req.method === 'GET' && path === '/api/pdf-layout-v2-preview') {
    return pdfLayoutV2Preview(req, res);
  }
  return app(req, res);
};
