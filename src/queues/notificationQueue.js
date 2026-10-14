const { Queue } = require("bullmq");
const IORedis = require("ioredis");

// BullMQ requires maxRetriesPerRequest: null, because its workers wait on Redis with long blocking requests.
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    // Keep only the latest jobs, so finished jobs don't fill Redis.
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

module.exports = { notificationQueue, connection };
