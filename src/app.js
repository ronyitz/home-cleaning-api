const express = require("express");
const { randomUUID } = require("crypto");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const historyRoutes = require("./routes/historyRoutes");
const aiRoutes = require("./routes/aiRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const { authenticate } = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
const ApiError = require("./utils/ApiError");
const logger = require("./config/logger");
const pinoHttp = require("pino-http");
const { rateLimiterRedis } = require("./middleware/rateLimiterRedis");

const app = express();

// Trust the first proxy hop (Render's load balancer) so req.ip reflects the real client IP.
app.set("trust proxy", 1);

// One log line per request. Keep only what we need - the default logs every header,
// including Authorization (the user's JWT).
app.use(pinoHttp({
  logger,
  // Unique across restarts (the default is a counter that starts at 1 again after every deploy).
  // Also sent back in a header so the client can report it and we can find the exact request in the logs.
  genReqId: (req, res) => {
    const id = randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  // 4xx = the client sent something wrong (warn), 5xx = our bug (error).
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Called with the real Express req when the line is written - authenticate has set userId by then.
  customProps: (req) => ({ userId: req.userId }),
  serializers: {
    // Called once when the request arrives, while pino-http creates req.log.
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    // Called once when the response has been sent, while the "request completed" line is written.
    res: (res) => ({ statusCode: res.statusCode }),
  },
  autoLogging: { ignore: (req) => req.url === "/api/health" }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

// exposedHeaders: browsers hide non-standard response headers from frontend JS unless CORS allows them.
app.use(cors({ origin: allowedOrigins, exposedHeaders: ["X-Request-Id"] }));
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// GET /api/health — keep-alive ping target; uptime shows whether the server restarted since the last ping.
app.get("/api/health", (req, res) => {
  const uptimeSeconds = Math.round(process.uptime());
  res.json({ status: "ok", uptimeSeconds });
});

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
if (RATE_LIMIT_ENABLED) {
  app.use(rateLimiterRedis);
}

app.use("/api/history", authenticate, historyRoutes);
app.use("/api/ai", authenticate, aiRoutes);
app.use("/api/rooms", authenticate, roomRoutes);
app.use("/api/tasks", authenticate, taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/push", authenticate, subscriptionRoutes);
// No route matched - without this Express answers with its own HTML 404 and errorHandler never runs.
app.use((req, res) => {
  throw new ApiError(404, "Route not found");
});
// Error handling middleware
app.use(errorHandler);

module.exports = app;