const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authenticate = require("./middleware/auth");

const app = express();

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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false";
const authMiddleware = AUTH_ENABLED ? authenticate : (req, res, next) => next();

app.use("/api/rooms", authMiddleware, roomRoutes);
app.use("/api/tasks", authMiddleware, taskRoutes);
app.use("/api/auth", authRoutes);

module.exports = app;