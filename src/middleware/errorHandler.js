const ApiError = require("../utils/ApiError");

function sendError(res, status, message) {
  res.status(status).json({
    success: false,
    error: { status, message },
  });
}

function errorHandler(err, req, res, next) {

  // MongoDB duplicate key
  if (err.code === 11000) {
    // Field names only - err.message and err.keyValue contain the duplicate value itself (e.g. a user's email).
    req.log.warn({ reason: "duplicate key", fields: Object.keys(err.keyValue ?? {}) }, "request rejected");
    return sendError(res, 409, "duplicated, already exists");
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    // Field -> kind of failure (e.g. { name: "required" }). err.message can contain the value the user sent.
    const fields = Object.fromEntries(Object.entries(err.errors ?? {}).map(([field, e]) => [field, e.kind]));
    req.log.warn({ reason: "validation failed", fields }, "request rejected");
    return sendError(res, 422, err.message);
  }

  // Our ApiError
  if (err instanceof ApiError || err.expose) {

    req.log.warn({ reason: err.message }, "request rejected");
    return sendError(res, err.status, err.message);
  }

  // Unexpected error
  req.log.error({ err }, "unhandled error");

  return sendError(res, 500, "שגיאה בשרת");
}

module.exports = errorHandler;