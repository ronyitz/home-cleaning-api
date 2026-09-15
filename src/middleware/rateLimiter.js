const ApiError = require("../utils/ApiError");

// In-memory store, keyed by IP. Lost on restart; not shared across multiple instances.
const requests = new Map();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 20 * 1000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 10;

// Periodically clean up old entries to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requests.entries()) {
    if (now - data.startTime >= WINDOW_MS) {
      requests.delete(ip);
    }
  }
}, WINDOW_MS);



function rateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  
  // First request ever seen from this IP — start tracking it.
  if (!requests.has(ip)) {
    requests.set(ip, {
      count: 1,
      startTime: now,
    });

    return next();
  }

  const data = requests.get(ip);

  // Window has expired — reset the count and start a fresh window.
  if (now - data.startTime >= WINDOW_MS) {
    requests.set(ip, {
      count: 1,
      startTime: now,
    });

    return next();
  }

  // Still within the window and already at the limit — reject.
  if (data.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((data.startTime + WINDOW_MS - now) / 1000);
    res.set("Retry-After", retryAfterSeconds);
    res.set("X-RateLimit-Limit", MAX_REQUESTS);
    throw new ApiError(429, "Too many requests");
  }

  data.count++;

  next();
}

// If the request is coming through Cloudflare, use the CF-Connecting-IP header; otherwise, use req.ip.
// Need to be changed if not using Render as cloud provider.
function getClientIp(req) {
  return req.headers["cf-connecting-ip"] || req.ip;
}

module.exports = rateLimiter;
