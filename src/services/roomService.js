const Room = require("../models/Room");
const Task = require("../models/Task");
const ApiError = require("../utils/ApiError");
const mongoose = require("mongoose");

const DAY_IN_MS = 24 * 60 * 60 * 1000;


async function getRooms(householdId) {
    if (!householdId || typeof householdId !== "string") {
        throw new ApiError(422, "household is required and must be a string");
    }
    return Room.find({ household: householdId });
}

async function updateRoom(roomId, { name, type }) {
    const room = await Room.findByIdAndUpdate(
        roomId,
        { name, type },
        { new: true, runValidators: true }
    );
    if (!room) {
        throw new ApiError(404, "Room not found");
    }
    return room;

}

async function createRoom({ name, type, tasks }, householdId) {
    let room;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            [room] = await Room.create([{ name: name, type: type, household: householdId }], { session });
            if (room) {
                await createMultipleTasksForNewRoom(room, tasks, session);
            }
        });
    } finally {
        session.endSession();
    }
    return room;
}

// Creates tasks for a newly created room, from a client-provided list of { name, frequency }.
async function createMultipleTasksForNewRoom(room, tasks, session) {
    if (!tasks || !tasks.length) {
        return;
    }
    const taskDocs = tasks.map((task) => ({
        name: task.name,
        room: room._id,
        frequency: task.frequency,
        nextDueAt: new Date(Date.now() + task.frequency * DAY_IN_MS),
    }));

    await Task.insertMany(taskDocs, { session });
}

// Deletes a room and all its tasks
async function deleteRoom(roomId) {
    let room;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            room = await Room.findByIdAndDelete(roomId, { session });
            if (room) {
                await Task.deleteMany({ room: room._id }, { session });
            }
        });
    } finally {
        session.endSession();
    }
    if (!room) {
        throw new ApiError(404, "Room not found");
    }
    return;
}





module.exports = { getRooms, updateRoom, createRoom, deleteRoom };
