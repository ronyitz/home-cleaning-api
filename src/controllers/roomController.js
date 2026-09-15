const Room = require("../models/Room");
const ApiError = require("../utils/ApiError");
const ROOM_TYPES = require("../constants/roomTypes");


// GET /api/rooms
async function getRooms(req, res) {
  const rooms = await Room.find();
  res.json(rooms);
}

// GET /api/rooms/types
async function getRoomTypes(req, res) {
  res.json(ROOM_TYPES);
}

// POST /api/rooms
async function createRoom(req, res) {
  const room = await Room.create({ name: req.body.name, type: req.body.type });
  res.status(201).json(room);
}

// DELETE /api/rooms/:id
async function deleteRoom(req, res) {
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }
  res.json({ message: "Room deleted" });
}

// PUT /api/rooms/:id
async function updateRoom(req, res) {
  const room = await Room.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name, type: req.body.type },
    { new: true, runValidators: true }
  );
  if (!room) {
    throw new ApiError(404, "Room not found");
  }
  res.json(room);
}



module.exports = { createRoom, getRooms, getRoomTypes, deleteRoom, updateRoom };
