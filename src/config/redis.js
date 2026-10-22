const { createClient } = require("redis");
const logger = require("./logger");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  logger.error({ err: error }, "redis client error");
});

module.exports = redisClient;
