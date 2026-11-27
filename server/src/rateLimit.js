/* eslint-env node */
/**
 * Small fixed-window limiter keyed by user id (or IP before auth). In-memory, so it is
 * per-instance: enough to blunt abuse of one server, not a global quota.
 */
const createRateLimiter = ({ limit = 120, windowMs = 60000, now = Date.now } = {}) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = (req.user && req.user.uid) || req.ip || 'anonymous';
    const t = now();
    let entry = hits.get(key);
    if (!entry || t >= entry.resetAt) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (t >= v.resetAt) hits.delete(k);
      }
    }

    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return res
        .status(429)
        .json({ error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } });
    }
    return next();
  };
};

module.exports = { createRateLimiter };
