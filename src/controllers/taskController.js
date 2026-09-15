const Task = require("../models/Task");
const Room = require("../models/Room");
const ApiError = require("../utils/ApiError");

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

  res.json(task);
}

// GET /api/tasks
async function getTasks(req, res) {

  const filter = {};
  if (req.query.maxNextDays) {
    filter.nextDueAt = { $lte: new Date(Date.now() + Number(req.query.maxNextDays) * DAY_IN_MS) };
  }

  const query = Task.find(filter).populate("room");
  if (req.query.sortByNextDue === "true") {
    query.sort({ nextDueAt: 1 });
  }
  const tasks = await query;
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
  const { name, room, frequency, status } = req.body;

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
    nextDueAt: new Date(Date.now() + daysUntilDue * DAY_IN_MS),
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
  const { name, room, frequency, lastCompletedAt } = req.body;

  const existingTask = await Task.findById(req.params.taskId);
  if (!existingTask) {
    throw new ApiError(404, "Task not found");
  }

  if (room) {
    const roomExists = await Room.findById(room);
    if (!roomExists) {
      throw new ApiError(404, "Room not found");
    }
  }

  const effectiveFrequency = frequency ?? existingTask.frequency;
  const effectiveLastCompletedAt = lastCompletedAt ?? existingTask.lastCompletedAt;
  const nextDueAt = effectiveLastCompletedAt
    ? new Date(new Date(effectiveLastCompletedAt).getTime() + effectiveFrequency * DAY_IN_MS)
    : undefined;

  const task = await Task.findByIdAndUpdate(
    req.params.taskId,
    { name, room, frequency, lastCompletedAt, nextDueAt },
    { new: true, runValidators: true }
  );
  res.json(task);
}

module.exports = { createTask, getTasks, getTasksPerRoom, completeTask, deleteTask, updateTask };
