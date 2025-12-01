// middleware/maintenance.js
module.exports = function maintenance({ enabledEnv = 'MAINTENANCE_MODE', allowPaths = [] } = {}) {
  return (req, res, next) => {
    // env value '1' or 'true' enables read-only mode
    const enabled = process.env[enabledEnv] === '1' || process.env[enabledEnv] === 'true';
    if (!enabled) return next();

    // allow healthchecks, static assets, and whitelisted paths
    if (allowPaths.some(p => req.path.startsWith(p))) return next();

    // allow safe GET/HEAD; block writes
    if (req.method === 'GET' || req.method === 'HEAD') return next();

    res.status(503).json({
      error: 'Service temporarily in read-only mode. Writes are disabled.',
      readOnly: true
    });
  };
};
