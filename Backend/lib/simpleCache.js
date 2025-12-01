// lib/simpleCache.js
const LRU = require('lru-cache');

const defaultTtl = parseInt(process.env.CACHE_TTL_MS || '300000', 10); // 5 min default

const cache = new LRU({
  max: 5000,
  ttl: defaultTtl
});

function cacheMiddleware({ keyFn, ttl } = {}) {
  return async (req, res, next) => {
    try {
      // only cache GET requests
      if (req.method !== 'GET') return next();

      const key = keyFn ? await keyFn(req) : req.originalUrl;
      const cached = cache.get(key);
      if (cached !== undefined) return res.json({ _cached: true, ...cached });

      // hijack res.json to cache response body
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        try {
          cache.set(key, body, { ttl: ttl ?? defaultTtl });
        } catch (e) { /* ignore cache set errors */ }
        return originalJson(body);
      };
      return next();
    } catch (e) {
      return next();
    }
  };
}

module.exports = { cache, cacheMiddleware };
