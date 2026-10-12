const taskService = require("../services/taskService");

// GET /api/tasks/:household
async function getTasks(req, res) {
  const tasks = await taskService.getTasks(req.params.household, req.query.maxNextDays);
  res.json(tasks);
}

// GET /api/tasks/room/:roomId
async function getTasksPerRoom(req, res) {
  const tasks = await taskService.getTasksPerRoom(req.params.roomId);
  res.json(tasks);
}

// POST /api/tasks
async function createTask(req, res) {
  const task = await taskService.createTask(req.body);
  res.status(201).json(task);
}

// PUT /api/tasks/:taskId
async function updateTask(req, res) {
  const task = await taskService.updateTask(req.params.taskId, req.body);
  res.json(task);
}

// PATCH /api/tasks/:taskId/complete
async function completeTask(req, res) {
  const task = await taskService.completeTask(req.params.taskId, req.userId);
  res.json(task);
}

// DELETE /api/tasks/:taskId
async function deleteTask(req, res) {
  await taskService.deleteTask(req.params.taskId);
  res.json({ message: "Task deleted" });
}

module.exports = { getTasks, getTasksPerRoom, createTask, updateTask, completeTask, deleteTask };
