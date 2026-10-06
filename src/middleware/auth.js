const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Household = require("../models/Household");
const Room = require("../models/Room");
const Task = require("../models/Task");


const ApiError = require("../utils/ApiError");

// Used in: app.js (global auth middleware, applied to /api/rooms, /api/tasks and /api/push)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.householdId = decoded.householdId;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Used in: roomRoutes.js (POST /, PUT /:id, DELETE /:id)
async function requireAdmin(req, res, next) {
  const userId = req.userId;
  const user = await User.findOne({ _id: userId });
  if (!user || user.role !== "admin") {
    throw new ApiError(403, "Unauthorized");
  }
  next();
}

// Used in: roomRoutes.js (GET /:household), taskRoutes.js (GET /:household)
async function requireSameHousehold(req, res, next) {
  // The household from the JWT
  const householdId = req.householdId;
  if(householdId !== req.params.household){
    throw new ApiError(403, "Unauthorized");
  }
  next();
}


function requireRoomHouseholdFrom(getRoomId) {
  return async function (req, res, next) {
    const room = await Room.findById(getRoomId(req));
    if (!room) {
      throw new ApiError(404, "Room not found");
    }
    if (String(room.household) !== String(req.householdId)) {
      throw new ApiError(403, "Unauthorized");
    }
    next();
  };
}

// Used in: roomRoutes.js (PUT /:id, DELETE /:id)
const requireHouseholdForRoom = requireRoomHouseholdFrom((req) => req.params.id);

// Used in: taskRoutes.js (POST /)
const requireHouseholdRoomForCreateTask = requireRoomHouseholdFrom((req) => req.body.room);

// Used in: taskRoutes.js (GET /room/:roomId)
const requireHouseholdRoomGetTasks = requireRoomHouseholdFrom((req) => req.params.roomId);

// Used in: taskRoutes.js (PATCH /:taskId/complete, DELETE /:taskId, PUT /:taskId)
async function requireTaskHousehold(req, res, next) {
  const task = await Task.findById(req.params.taskId).populate("room", "household");
  if (!task) {
    throw new ApiError(404, "Task not found");
  }
  if (String(task.room.household) !== String(req.householdId)) {
    throw new ApiError(403, "Unauthorized");
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireSameHousehold, requireHouseholdForRoom, requireHouseholdRoomForCreateTask, requireHouseholdRoomGetTasks, requireTaskHousehold};
