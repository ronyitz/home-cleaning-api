// Unit tests for createRateLimiter.
// Calls the middleware directly (no app, no HTTP) and replaces the Redis client
// with an in-memory fake, so no real Redis is needed.
// RATE_LIMIT_ENABLED is NOT set to "false" here — the limiter is what we test.

// Fake Redis: only the commands the limiter uses (incr, expire, ttl).
jest.mock("../src/config/redis", () => {
  const store = new Map();

  return {
    incr: jest.fn(async (key) => {
      const entry = store.get(key) || { count: 0, ttl: -1 };
      entry.count += 1;
      store.set(key, entry);
      return entry.count;
    }),
    expire: jest.fn(async (key, seconds, mode) => {
      const entry = store.get(key);
      if (entry) {
        if (mode === "NX" && entry.ttl !== -1) {
          return false;
        } else {
          entry.ttl = seconds;
          return true;
        }
      } else {
        return false;
      }
    }),
    ttl: jest.fn(async (key) => {
      const entry = store.get(key);
      if (entry) {
        return entry.ttl;
      } else {
        return -2;
      }
    }),
    __reset: () => store.clear(),
  };
});

const redisClient = require("../src/config/redis");
const { createRateLimiter } = require("../src/middleware/rateLimiterRedis");

afterEach(() => {
  redisClient.__reset();
  delete process.env.RATE_LIMIT_ENABLED;
  jest.clearAllMocks();
});

describe("createRateLimiter", () => {
  it("calls next for requests up to max", async () => {
    const rateLimiter = createRateLimiter({ prefix: "redisTest", windowMs: 60000, max: 3, keyform: (req) => req.userId, message: "Too many requests" });

    const req = { userId: "user1" };
    const res = { set: jest.fn() };
    const next = jest.fn();

    await rateLimiter(req, res, next);
    await rateLimiter(req, res, next);
    await rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.set).not.toHaveBeenCalled();
  });

  it("throws 429 with the message on request max+1", async () => {
    const rateLimiter = createRateLimiter({ prefix: "redisTest", windowMs: 60000, max: 3, keyform: (req) => req.userId, message: "Too many requests" });
    const req = { userId: "user1" };
    const res = { set: jest.fn() };
    const next = jest.fn();
    await rateLimiter(req, res, next);
    await rateLimiter(req, res, next);
    await rateLimiter(req, res, next);
    await expect(rateLimiter(req, res, next)).rejects.toMatchObject({ status: 429, message: "Too many requests" });
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("counts different keys separately", async () => {
    const rateLimiter = createRateLimiter({ prefix: "redisTest", windowMs: 60000, max: 3, keyform: (req) => req.userId, message: "Too many requests" });
    const req1 = { userId: "user1" };
    const req2 = { userId: "user2" };
    const res = { set: jest.fn() };
    const next = jest.fn();

    // user1 reaches the limit
    await rateLimiter(req1, res, next);
    await rateLimiter(req1, res, next);
    await rateLimiter(req1, res, next);
    await expect(rateLimiter(req1, res, next)).rejects.toMatchObject({ status: 429 });

    // user2 has its own counter, so it still passes
    await rateLimiter(req2, res, next);
    expect(next).toHaveBeenCalledTimes(4);
  });

  it("sets expire in seconds with NX", async () => {
    const rateLimiter = createRateLimiter({ prefix: "redisTest", windowMs: 60000, max: 3, keyform: (req) => req.userId, message: "Too many requests" });
    const req = { userId: "user1" };
    const res = { set: jest.fn() };
    const next = jest.fn();
    await rateLimiter(req, res, next);
    expect(redisClient.expire).toHaveBeenCalledWith("redisTest:user1", 60, "NX");
  });

  it("sets Retry-After and X-RateLimit-Limit headers on 429", async () => {
    const rateLimiter = createRateLimiter({ prefix: "redisTest", windowMs: 60000, max: 3, keyform: (req) => req.userId, message: "Too many requests" });
    const req = { userId: "user1" };
    const res = { set: jest.fn() };
    const next = jest.fn();

    await rateLimiter(req, res, next);
    await rateLimiter(req, res, next);
    await rateLimiter(req, res, next);
    await expect(rateLimiter(req, res, next)).rejects.toMatchObject({ status: 429 });
    expect(res.set).toHaveBeenCalledTimes(2);
    expect(res.set).toHaveBeenNthCalledWith(1, "Retry-After", 60);
    expect(res.set).toHaveBeenNthCalledWith(2, "X-RateLimit-Limit", 3);
  });

  it("calls next without touching Redis when RATE_LIMIT_ENABLED is false", async () => {
    process.env.RATE_LIMIT_ENABLED = "false";
    const rateLimiter = createRateLimiter({ prefix: "redisTest", windowMs: 60000, max: 3, keyform: (req) => req.userId, message: "Too many requests" });
    const req = { userId: "user1" };
    const res = { set: jest.fn() };
    const next = jest.fn();

    await rateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(redisClient.incr).not.toHaveBeenCalled();

    delete process.env.RATE_LIMIT_ENABLED;
  });
});
