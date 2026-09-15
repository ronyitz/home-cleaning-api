const express = require("express");
const { createTask, getTasks, getTasksPerRoom,completeTask, deleteTask, updateTask } = require("../controllers/taskController");
const { validateTask, validateObjectIdParam } = require("../middleware/validate");

const router = express.Router();

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of tasks
 *   post:
 *     summary: Create a task
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, room, frequency, status]
 *             properties:
 *               name:
 *                 type: string
 *               room:
 *                 type: string
 *                 description: Room id
 *               frequency:
 *                 type: number
 *                 description: Days between cleanings
 *               status:
 *                 type: string
 *                 enum: [good, middle, bad]
 *     responses:
 *       201:
 *         description: Task created
 *       404:
 *         description: Room not found
 */
router.get("/", getTasks);
router.post("/", validateTask, createTask);

/**
 * @swagger
 * /tasks/room/{roomId}:
 *   get:
 *     summary: Get tasks for a specific room
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks for the room
 */
router.get("/room/:roomId", validateObjectIdParam("roomId"), getTasksPerRoom);

/**
 * @swagger
 * /tasks/{taskId}/complete:
 *   patch:
 *     summary: Mark a task as completed and recompute its next due date
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task updated
 *       404:
 *         description: Task not found
 */
router.patch("/:taskId/complete", validateObjectIdParam("taskId"), completeTask);

/**
 * @swagger
 * /tasks/{taskId}:
 *   delete:
 *     summary: Delete a task by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted
 *       404:
 *         description: Task not found
 *   put:
 *     summary: Update a task
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               room:
 *                 type: string
 *               frequency:
 *                 type: number
 *               lastCompletedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Task updated
 *       404:
 *         description: Task not found
 */
router.delete("/:taskId", validateObjectIdParam("taskId"), deleteTask);
router.put("/:taskId", validateObjectIdParam("taskId"), validateTask, updateTask);

module.exports = router;
