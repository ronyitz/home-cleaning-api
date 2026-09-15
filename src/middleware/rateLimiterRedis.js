const ApiError = require("../utils/ApiError");
const redisClient = require("../config/redis");

const MAX_REQUESTS = 30;
const WINDOW = 10; // seconds

async function rateLimiterRedis(req, res, next) {
  const ip = getClientIp(req);
  const key = `ratelimit:${ip}`;

  // INCR is atomic: it creates the key at 1 if missing, or increments it if it exists —
  // avoids the race condition of separate GET-then-SET calls under concurrent requests.
  const count = await redisClient.incr(key);

  if (count === 1) {
    await redisClient.expire(key, WINDOW);
  }

  if (count > MAX_REQUESTS) {
    const retryAfterSeconds = await redisClient.ttl(key);
    res.set("Retry-After", retryAfterSeconds);
    res.set("X-RateLimit-Limit", MAX_REQUESTS);
    throw new ApiError(429, "Too many requests");
  }

  next();
}

// If the request is coming through Cloudflare, use the CF-Connecting-IP header; otherwise, use req.ip.
// Need to be changed if not using Render as cloud provider.
function getClientIp(req) {
  return req.headers["cf-connecting-ip"] || req.ip;
}

module.exports = { rateLimiterRedis };
