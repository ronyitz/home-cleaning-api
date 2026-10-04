const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const ROOM_TYPES = require("../constants/roomTypes");

const ROOM_TYPE_VALUES = ROOM_TYPES.map((t) => t.value);
const TASK_STATUS_VALUES = ["good", "middle", "bad"];

function validateRoom(req, res, next) {
  const { name, type } = req.body;

  if (!name || typeof name !== "string") {
    throw new ApiError(422, "name is required and must be a string");
  }

if (!name.trim()) {
  throw new ApiError(422, "name cannot be empty");
}

  if (!type || typeof type !== "string") {
  throw new ApiError(422, "type is required and must be a string");
  } 

  if (type !== undefined && !ROOM_TYPE_VALUES.includes(type)) {
    throw new ApiError(422, `type must be one of: ${ROOM_TYPE_VALUES.join(", ")}`);
  }

  next();
}

function validateCreateTask(req, res, next) {
  const { name, room, frequency, status } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ApiError(422, "name is required and must be a non-empty string");
  }

  if (!room || !mongoose.Types.ObjectId.isValid(room)) {
    throw new ApiError(422, "room is required and must be a valid id");
  }

  if (typeof frequency !== "number" || frequency < 1) {
    throw new ApiError(422, "frequency is required and must be a number >= 1");
  }

  if (status && !TASK_STATUS_VALUES.includes(status)) {
    throw new ApiError(422, `status must be one of: ${TASK_STATUS_VALUES.join(", ")}`);
  }

  next();
}

function validateUpdateTask(req, res, next) {
  const { name, frequency, status } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ApiError(422, "name is required and must be a non-empty string");
  }

  if (typeof frequency !== "number" || frequency < 1) {
    throw new ApiError(422, "frequency is required and must be a number >= 1");
  }

  if (status && !TASK_STATUS_VALUES.includes(status)) {
    throw new ApiError(422, `status must be one of: ${TASK_STATUS_VALUES.join(", ")}`);
  }

  next();
}

function validatePushSubscription(req, res, next) {
  const { endpoint, keys } = req.body;

  if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    throw new ApiError(422, "endpoint is required and must be a non-empty string and real endpoint");
  }

  if (!keys || typeof keys !== "object" || !keys.p256dh || typeof keys.p256dh !== "string" || !keys.p256dh.trim() || !keys.auth || typeof keys.auth !== "string" || !keys.auth.trim()) {
    throw new ApiError(422, "keys is required and must be a non-empty Object");
  }

  next();
}

function validateObjectIdParam(paramName) {
  return function (req, res, next) {
    if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
      throw new ApiError(422, `${paramName} must be a valid id`);
    }
    next();
  };
}

module.exports = { validateRoom, validateCreateTask, validateUpdateTask, validatePushSubscription, validateObjectIdParam };