const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authenticate = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
// const rateLimiter = require("./middleware/rateLimiter");

const app = express();

// Trust the first proxy hop (Render's load balancer) so req.ip reflects the real client IP.
app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5174"];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Home Cleaning API is running!",
  });
});

app.get("/debug/ip", (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    forwardedFor: req.headers["x-forwarded-for"],
    remoteAddress: req.socket.remoteAddress,
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Use authentication middleware for all routes except /api/auth
const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";
const authMiddleware = AUTH_ENABLED ? authenticate : (req, res, next) => next();

// app.use(rateLimiter);
app.use("/api/rooms", authMiddleware, roomRoutes);
app.use("/api/tasks", authMiddleware, taskRoutes);
app.use("/api/auth", authRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app;