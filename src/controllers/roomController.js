const Room = require("../models/Room");
const Task = require("../models/Task");
const ApiError = require("../utils/ApiError");
const ROOM_TYPES = require("../constants/roomTypes");

const DAY_IN_MS = 24 * 60 * 60 * 1000;


// GET /api/rooms/:household
async function getRooms(req, res) {
  if(!req.params.household) {
    throw new ApiError(422, "household is required and must be a string");
  }
  const rooms = await Room.find({ household: req.params.household });
  res.json(rooms);
}

// GET /api/rooms/types
async function getRoomTypes(req, res) {
  res.json(ROOM_TYPES);
}

// Creates tasks for a newly created room, from a client-provided list of { name, frequency }.
async function createMultipleTasksForNewRoom(room, tasks) {
  if (!tasks || !tasks.length) {
    return;
  }

  const taskDocs = tasks.map((task) => ({
    name: task.name,
    room: room._id,
    frequency: task.frequency,
    nextDueAt: new Date(Date.now() + task.frequency * DAY_IN_MS),
  }));

  await Task.insertMany(taskDocs);
}

// POST /api/rooms
async function createRoom(req, res) {
  const room = await Room.create({ name: req.body.name, type: req.body.type, household: req.body.household } );
  if (room) {
    await createMultipleTasksForNewRoom(room, req.body.tasks);
  }
  res.status(201).json(room);
}

// DELETE /api/rooms/:id
async function deleteRoom(req, res) {
  const room = await Room.findByIdAndDelete(req.params.id);
  if (!room) {
    throw new ApiError(404, "Room not found");
  }
  await Task.deleteMany({ room: room._id });
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
