const ApiError = require("../utils/ApiError");
const redisClient = require("../config/redis");

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

const AI_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS_AI) || 3600000;
const AI_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS_AI) || 3;

// Returns a fixed-window rate limiter middleware. keyform(req) says who is counted (an IP, a user id...).
function createRateLimiter({ prefix, windowMs, max, keyform, message }) {
  return async function (req, res, next) {
    if (process.env.RATE_LIMIT_ENABLED === "false") return next();

    const key = `${prefix}:${keyform(req)}`;

    // INCR is atomic: it creates the key at 1 if missing, or increments it if it exists —
    // avoids the race condition of separate GET-then-SET calls under concurrent requests.
    const count = await redisClient.incr(key);
    // EXPIRE with NX sets the TTL only if the key has none, so a failed first request can't leave a key that never expires.
    await redisClient.expire(key, Math.ceil(windowMs / 1000), "NX");

    if (count > max) {
      const retryAfterSeconds = await redisClient.ttl(key);
      res.set("Retry-After", retryAfterSeconds);
      res.set("X-RateLimit-Limit", max);
      throw new ApiError(429, message);
    }

    next();

  };
}

// If the request is coming through Cloudflare, use the CF-Connecting-IP header; otherwise, use req.ip.
// Need to be changed if not using Render as cloud provider.
function getClientIp(req) {
  return req.headers["cf-connecting-ip"] || req.ip;
}

// General limiter for the whole API, per IP.
const rateLimiterRedis = createRateLimiter({ prefix: "ratelimit:global", windowMs: WINDOW_MS, max: MAX_REQUESTS, keyform: (req) => getClientIp(req), message: "Too many requests" });
// Stricter limiter for the paid AI endpoint, per user.
const rateLimiterRedisAIRequests = createRateLimiter({ prefix: "ratelimit:ai", windowMs: AI_WINDOW_MS, max: AI_MAX_REQUESTS, keyform: (req) => req.userId, message: "Too many AI requests" });

module.exports = { rateLimiterRedis, rateLimiterRedisAIRequests };
