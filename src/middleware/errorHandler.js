function sendError(res, status, message) {
  res.status(status).json({
    success: false,
    error: { status, message },
  });
}

function errorHandler(err, req, res, next) {
  
  // MongoDB duplicate key
  if (err.code === 11000) {
    return sendError(res, 409, "duplicated, already exists");
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return sendError(res, 422, err.message);
  }

  // Our ApiError
  if (err.status) {
    return sendError(res, err.status, err.message);
  }

  // Unexpected error
  console.error(err);

  return sendError(res, 500, "שגיאה בשרת");
}

module.exports = errorHandler;