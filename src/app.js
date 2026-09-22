const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const {authenticate} = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
const { rateLimiterRedis } = require("./middleware/rateLimiterRedis");

const app = express();

// Trust the first proxy hop (Render's load balancer) so req.ip reflects the real client IP.
app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5174"];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Use authentication middleware for all routes except /api/auth
const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";
const authMiddleware = AUTH_ENABLED ? authenticate : (req, res, next) => next()


const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
if (RATE_LIMIT_ENABLED) {
  app.use(rateLimiterRedis);
}
app.use("/api/rooms", authMiddleware, roomRoutes);
app.use("/api/tasks", authMiddleware, taskRoutes);
app.use("/api/auth", authRoutes);
// Error handling middleware
app.use(errorHandler);

module.exports = app;