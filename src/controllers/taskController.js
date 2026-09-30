const Task = require("../models/Task");
const Room = require("../models/Room");
const ApiError = require("../utils/ApiError");
const { notifyHousehold } = require("../services/pushService");

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// PATCH /api/tasks/:taskId/complete
async function completeTask(req, res) {
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  task.lastCompletedAt = new Date();
  task.nextDueAt = new Date(Date.now() + task.frequency * DAY_IN_MS);
  await task.save();

  // Fire-and-forget: the response shouldn't wait for push delivery.
  notifyHousehold({ title: task.name + "הושלמה ", body: "כל הכבוד חמוד!" }).catch((error) =>
    console.error("Push notification failed:", error)
  );

  res.json(task);
}

// GET /api/tasks/:household
async function getTasks(req, res) {
  if (!req.params.household) {
    throw new ApiError(422, "household is required and must be a string");
  }

  const rooms = await Room.find({ household: req.params.household }, "_id");
  const filter = { room: { $in: rooms.map((r) => r._id) } };
  if (req.query.maxNextDays) {
    filter.nextDueAt = { $lte: new Date(Date.now() + Number(req.query.maxNextDays) * DAY_IN_MS) };
  }

  const tasks = await Task.find(filter).populate("room");
  tasks.sort((a, b) => a.nextDueAt - b.nextDueAt);
  tasks.sort((a, b) => a.room.createdAt - b.room.createdAt);
  res.json(tasks);
}

// GET /api/tasks/room/:roomId
async function getTasksPerRoom(req, res) {
  const tasks = await Task.find({ room: req.params.roomId }).sort({ nextDueAt: 1 });
  res.json(tasks);
}

// POST /api/tasks
async function createTask(req, res) {
  const { name, room, frequency, status, lastCompletedAt, note } = req.body;

  const roomExists = await Room.findById(room);
  if (!roomExists) {
    throw new ApiError(404, "Room not found");
  }

  let daysUntilDue;
  if (status === "good") {
    daysUntilDue = frequency;
  } else if (status === "middle") {
    daysUntilDue = Math.ceil(frequency / 2);
  } else {
    daysUntilDue = 0;
  }

  const task = await Task.create({
    name,
    room,
    frequency,
    lastCompletedAt,
    nextDueAt: new Date(new Date(lastCompletedAt).getTime() + daysUntilDue * DAY_IN_MS),
    note,
  });
  res.status(201).json(task);
}

// DELETE /api/tasks/:taskId
async function deleteTask(req, res) {
  const task = await Task.findByIdAndDelete(req.params.taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }
  res.json({ message: "Task deleted" });
}

// PUT /api/tasks/:taskId
async function updateTask(req, res) {
  const { name, frequency, lastCompletedAt, note } = req.body;

  const existingTask = await Task.findById(req.params.taskId);
  if (!existingTask) {
    throw new ApiError(404, "Task not found");
  }

  const effectiveFrequency = frequency ?? existingTask.frequency;
  const effectiveLastCompletedAt = lastCompletedAt ?? existingTask.lastCompletedAt;
  const nextDueAt = effectiveLastCompletedAt
    ? new Date(new Date(effectiveLastCompletedAt).getTime() + effectiveFrequency * DAY_IN_MS)
    : undefined;

  const task = await Task.findByIdAndUpdate(
    req.params.taskId,
    { name, frequency, lastCompletedAt, nextDueAt, note },
    { new: true, runValidators: true }
  );
  res.json(task);
}

module.exports = { createTask, getTasks, getTasksPerRoom, completeTask, deleteTask, updateTask };
