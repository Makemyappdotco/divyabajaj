const ADMIN_USER = process.env.ADMIN_USERNAME || 'divya';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'changethispassword123';

function adminAuth(req, res, next) {
  const publicPostPaths = ['/leads', '/reports/free', '/payments/webhook', '/calculate'];

  if (req.method === 'POST' && publicPostPaths.some(p => req.path === p || req.path.startsWith(`${p}/`))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [user, pass] = credentials.split(':');

  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();

  return res.status(403).json({ error: 'Invalid credentials' });
}

function generateToken() {
  return Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
}

module.exports = { adminAuth, generateToken, ADMIN_USER, ADMIN_PASS };
