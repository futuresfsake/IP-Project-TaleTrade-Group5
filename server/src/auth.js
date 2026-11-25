/* eslint-env node */
const { unauthorized } = require('./errors');

/**
 * Requires `Authorization: Bearer <Firebase ID token>`. `verifyToken(token)` resolves to
 * { uid } or rejects; it is injected so tests need no Firebase.
 */
const createAuthMiddleware = verifyToken => async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const match = /^Bearer (.+)$/i.exec(header);
  if (!match) return next(unauthorized('Missing bearer token.'));
  try {
    const decoded = await verifyToken(match[1]);
    if (!decoded || !decoded.uid) return next(unauthorized('Invalid token.'));
    req.user = { uid: decoded.uid };
    return next();
  } catch {
    return next(unauthorized('Invalid or expired token.'));
  }
};

module.exports = { createAuthMiddleware };
