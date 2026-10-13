
const ROOM_TYPES = require("../constants/roomTypes");
const roomService = require("../services/roomService");

// GET /api/rooms/:household
async function getRooms(req, res) {
  const rooms = await roomService.getRooms(req.params.household);
  res.status(200).json(rooms);
}

// PUT /api/rooms/:id
async function updateRoom(req, res) {
  const room = await roomService.updateRoom(req.params.id, req.body);
  res.status(200).json(room);
}

// POST /api/rooms
async function createRoom(req, res) {
  const room = await roomService.createRoom(req.body, req.householdId);
  res.status(201).json(room);
}

// DELETE /api/rooms/:id
async function deleteRoom(req, res) {
  await roomService.deleteRoom(req.params.id);
  res.status(200).json({ message: "Room deleted" });
}

// GET /api/rooms/types
async function getRoomTypes(req, res) {
  res.json(ROOM_TYPES);
}

// PUT /api/rooms/order
async function reorderRooms(req, res) {
  const rooms = await roomService.reorderRooms(req.householdId, req.body);
  res.status(200).json(rooms);
}

module.exports = { createRoom, getRooms, getRoomTypes, deleteRoom, updateRoom, reorderRooms };
