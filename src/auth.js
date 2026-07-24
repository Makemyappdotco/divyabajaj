const ADMIN_USER = process.env.ADMIN_USERNAME || 'divya';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';

function requestLogin(res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Divya Bajaj Admin"');
  return res.status(401).send('Authentication required');
}

function adminAuth(req, res, next) {
  const publicPostPaths = ['/reports/free', '/payments/webhook', '/calculate'];
  const isPublicPost = req.method === 'POST' && publicPostPaths.some(p => req.path === p || req.path.startsWith(`${p}/`));
  const isPublicPdf = req.method === 'GET' && /^\/reports\/[^/]+\/pdf$/.test(req.path);

  if (isPublicPost || isPublicPdf) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return requestLogin(res);
  }

  const encoded = authHeader.split(' ')[1] || '';
  let credentials = '';
  try { credentials = Buffer.from(encoded, 'base64').toString(); }
  catch (error) { return requestLogin(res); }

  const separatorIndex = credentials.indexOf(':');
  if (separatorIndex < 0) return requestLogin(res);

  const user = credentials.slice(0, separatorIndex);
  const pass = credentials.slice(separatorIndex + 1);

  if (ADMIN_PASS && user === ADMIN_USER && pass === ADMIN_PASS) return next();

  return requestLogin(res);
}

function generateToken() {
  if (!ADMIN_PASS) return '';
  return Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
}

function adminConfigured() {
  return Boolean(ADMIN_PASS);
}

module.exports = { adminAuth, generateToken, adminConfigured, ADMIN_USER, ADMIN_PASS };
