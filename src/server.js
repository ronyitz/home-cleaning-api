require("dotenv").config();

const REQUIRED = ["MONGO_URI", "REDIS_URL", "JWT_SECRET"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const mongoose = require("mongoose");
const redisClient = require("./config/redis");
const app = require("./app");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await redisClient.connect();
    console.log("Connected to Redis");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

startServer();