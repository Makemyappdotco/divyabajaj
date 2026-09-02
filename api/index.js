require('../src/services/locationSearchUpgrade')();
const app = require('../src/server.js');
require('../src/services/finalPaidPdfV4Patch')();
module.exports = app;
