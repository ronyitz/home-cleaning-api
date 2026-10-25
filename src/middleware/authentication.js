const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

// Who are you? Missing or bad token -> 401. Permission checks (403) live in authorization.js.
// Used in: app.js (applied to /api/history, /api/ai, /api/rooms, /api/tasks and /api/push)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "No token provided");
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token");
  }
  req.householdId = decoded.householdId;
  req.userId = decoded.userId;
  req.log = req.log.child({ userId: req.userId });
  next();
}

module.exports = { authenticate };
