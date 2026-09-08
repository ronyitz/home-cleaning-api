const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const roomRoutes = require("./routes/roomRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authenticate = require("./middleware/auth");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Home Cleaning API is running!",
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/rooms", authenticate, roomRoutes);
app.use("/api/tasks", authenticate, taskRoutes);
app.use("/api/auth", authRoutes);

module.exports = app;