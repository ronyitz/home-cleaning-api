const Task = require("../models/Task");
const Room = require("../models/Room");




// PATCH /api/tasks/:taskId/complete
async function completeTask(req, res) {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.lastCompletedAt = new Date();
    task.nextDueAt = new Date(Date.now() + task.frequency * 24 * 60 * 60 * 1000); // frequency in days
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// GET /api/tasks
async function getTasks(req, res) {
  try {
    const filter = {};
    if (req.query.maxNextDays) {
      filter.nextDueAt = { $lte: new Date(Date.now() + Number(req.query.maxNextDays) * DAY_IN_MS) };
    }

    const query = Task.find(filter);
    if (req.query.sortByNextDue === "true") {
      query.sort({ nextDueAt: 1 });
    }
    const tasks = await query;
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// GET /api/tasks/room/:roomId
async function getTasksPerRoom(req, res) {
  try {
    const tasks = await Task.find({ room: req.params.roomId });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// POST /api/tasks
async function createTask(req, res) {
  try {
    const { name, room, frequency, status } = req.body;

    const roomExists = await Room.findById(room);
    if (!roomExists) {
      return res.status(404).json({ message: "Room not found" });
    }

    let daysUntilDue;
    if (status === "good") {
      daysUntilDue = frequency;
    } else if (status === "middle") {
      daysUntilDue = Math.ceil(frequency / 2);
    } else if (status === "bad") {
      daysUntilDue = 0;
    } else {
      return res.status(400).json({ message: "status must be 'good', 'middle', or 'bad'" });
    }

    const task = await Task.create({
      name,
      room,
      frequency,
      nextDueAt: new Date(Date.now() + daysUntilDue * DAY_IN_MS),
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// DELETE /api/tasks/:taskId
async function deleteTask(req, res) {
  try {
    const task = await Task.findByIdAndDelete(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json({ message: "Task deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// PUT /api/tasks/:taskId
async function updateTask(req, res) {
  try {
    const { name, room, frequency, lastCompletedAt } = req.body;

    const existingTask = await Task.findById(req.params.taskId);
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (room) {
      const roomExists = await Room.findById(room);
      if (!roomExists) {
        return res.status(404).json({ message: "Room not found" });
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
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

module.exports = { createTask, getTasks, getTasksPerRoom, completeTask, deleteTask, updateTask };
