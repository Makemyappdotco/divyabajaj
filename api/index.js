require('../src/services/locationSearchUpgrade')();
const app = require('../src/server.js');
const reportHtmlRoutes = require('../src/reportHtmlRoutes');

// The HTML report renderer is isolated from the existing report-generation,
// location, payment and free-report routes. On Vercel all traffic reaches this
// entrypoint, so the private report view/export routes are mounted here.
app.use(reportHtmlRoutes);

module.exports = app;
