const express = require("express");
const { createRoom, getRooms, getRoomTypes, deleteRoom, updateRoom } = require("../controllers/roomController");
const { validateRoom, validateObjectIdParam } = require("../middleware/validate");

const router = express.Router();

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a room
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Room created
 *       409:
 *         description: Room name already exists
 *   get:
 *     summary: Get all rooms
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of rooms
 */
router.post("/", validateRoom, createRoom);
router.put("/:id", validateObjectIdParam("id"), validateRoom, updateRoom);
router.get("/types", getRoomTypes);
router.get("/:household", getRooms);

/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     summary: Delete a room by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room deleted
 *       404:
 *         description: Room not found
 *   put:
 *     summary: Update a room's name
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Room updated
 *       404:
 *         description: Room not found
 *       409:
 *         description: Room name already exists
 */
router.delete("/:id", validateObjectIdParam("id"), deleteRoom);

module.exports = router;
