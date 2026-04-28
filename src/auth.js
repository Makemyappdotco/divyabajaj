const ADMIN_USER = process.env.ADMIN_USERNAME || 'divya';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'changethispassword123';

function requestLogin(res) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Divya Bajaj Admin"');
  return res.status(401).send('Authentication required');
}

function adminAuth(req, res, next) {
  const publicPostPaths = ['/leads', '/reports/free', '/payments/webhook', '/calculate'];
  const isPublicPost = req.method === 'POST' && publicPostPaths.some(p => req.path === p || req.path.startsWith(`${p}/`));
  const isPublicPdf = req.method === 'GET' && /^\/reports\/[^/]+\/pdf$/.test(req.path);

  if (isPublicPost || isPublicPdf) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return requestLogin(res);
  }

  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const separatorIndex = credentials.indexOf(':');
  const user = credentials.slice(0, separatorIndex);
  const pass = credentials.slice(separatorIndex + 1);

  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();

  return requestLogin(res);
}

function generateToken() {
  return Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
}

module.exports = { adminAuth, generateToken, ADMIN_USER, ADMIN_PASS };
