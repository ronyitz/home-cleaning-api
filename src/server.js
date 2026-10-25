require("dotenv").config();

const REQUIRED = ["MONGO_URI", "REDIS_URL", "JWT_SECRET"];

const logger = require("./config/logger");

// Last line of defense for errors nobody caught (outside a request, e.g. in the worker or a callback).
// Without these, Node prints a plain stack (not JSON) and dies. Log it as fatal, then exit -
// the process may be in a broken state, so let Render restart it clean.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled rejection");
  process.exit(1);
});

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  logger.error({ missing }, "missing required environment variables");
  process.exit(1);
}

const mongoose = require("mongoose");
const redisClient = require("./config/redis");
const app = require("./app");
const { registerSchedulers } = require("./queues/schedulers");
const { startNotificationWorker } = require("./workers/notificationWorker");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("connected to MongoDB");

    await redisClient.connect();
    logger.info("connected to Redis");

    await registerSchedulers();
    startNotificationWorker();
    logger.info("notification worker started");

    app.listen(PORT, () => {
      logger.info({ port: PORT }, "server running");
    });
  } catch (error) {
    logger.error({ err: error }, "server startup error");
    process.exit(1);
  }
}

startServer();