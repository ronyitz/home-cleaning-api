const Room = require("../models/Room");

// POST /api/rooms
async function createRoom(req, res) {
  try {
    const room = await Room.create({ name: req.body.name });
    res.status(201).json(room);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Room name already exists" });
    }
    res.status(400).json({ message: error.message });
  }
}

// GET /api/rooms
async function getRooms(req, res) {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// DELETE /api/rooms/:id
async function deleteRoom(req, res) {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// PUT /api/rooms/:id
async function updateRoom(req, res) {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true, runValidators: true }
    );
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Room name already exists" });
    }
    res.status(400).json({ message: error.message });
  }
}

module.exports = { createRoom, getRooms, deleteRoom, updateRoom };
