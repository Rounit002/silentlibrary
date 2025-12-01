// lib/dbWrap.js
function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), ms))
  ]);
}

async function safeQuery(dbClient, sql, params = [], opts = {}) {
  const timeout = opts.timeout || parseInt(process.env.DB_QUERY_TIMEOUT_MS || '4000', 10);
  try {
    return await withTimeout(dbClient.query(sql, params), timeout);
  } catch (err) {
    // Bubble up, calling code should use fallback/cached response
    err.isDbTimeout = (err.message === 'DB_TIMEOUT');
    throw err;
  }
}

module.exports = { withTimeout, safeQuery };
