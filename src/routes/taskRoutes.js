const express = require("express");
const { createTask, getTasks, getTasksPerRoom,completeTask, deleteTask, updateTask } = require("../controllers/taskController");

const router = express.Router();

router.get("/", getTasks);
router.get("/room/:roomId", getTasksPerRoom);
router.post("/", createTask);
router.patch("/:taskId/complete", completeTask);
router.delete("/:taskId", deleteTask);
router.put("/:taskId", updateTask);

module.exports = router;
