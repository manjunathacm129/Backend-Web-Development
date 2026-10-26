// TODO: Implement requireAuth middleware.
//
// This function currently calls next() unconditionally — all routes are unprotected.
// Replace this with a proper implementation that:
//
// 1. Reads the Authorization header from the request (req.headers.authorization).
//    Use `?? ''` so you never work with undefined.
//
// 2. Extracts the Bearer token using a strict regex:
//      /^Bearer ([^\s]+)$/i
//    If the regex does not match, token = null.
//
// 3. Returns 401 immediately if token is null:
//      res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } })
//
// 4. Calls jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }) inside a try block.
//    On success:
//      - Set req.user = the verified payload
//      - Call next()
//
// 5. In the catch block, returns the same generic 401 response for every error type.
//    Do NOT distinguish TokenExpiredError from JsonWebTokenError in the client response.
//
const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  const token = match ? match[1] : null;

  if (!token) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    return next();
  } catch (_error) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    });
  }
};
