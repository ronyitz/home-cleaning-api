const Task = require("../models/Task");
const Room = require("../models/Room");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { notificationQueue } = require("../queues/notificationQueue");
const mongoose = require("mongoose");
const TaskCompletion = require("../models/TaskCompletion");

const DAY_IN_MS = 24 * 60 * 60 * 1000;


async function getTasks(householdId, maxNextDays) {
    if (!householdId) {
        throw new ApiError(422, "household is required and must be a string");
    }

    const rooms = await Room.find({ household: householdId }, "_id");
    const filter = { room: { $in: rooms.map((r) => r._id) } };
    if (maxNextDays) {
        filter.nextDueAt = { $lte: new Date(Date.now() + Number(maxNextDays) * DAY_IN_MS) };
    }

    const tasks = await Task.find(filter).populate("room");
    tasks.sort((a, b) => a.nextDueAt - b.nextDueAt);
    tasks.sort((a, b) => a.room.createdAt - b.room.createdAt);
    return tasks;
}

async function getTasksPerRoom(roomId) {
    return Task.find({ room: roomId }).sort({ nextDueAt: 1 });
}

async function createTask({ name, room, frequency, status, lastCompletedAt, note }) {
    const roomExists = await Room.findById(room);
    if (!roomExists) {
        throw new ApiError(404, "Room not found");
    }

    let daysUntilDue;
    if (status === "good") {
        daysUntilDue = frequency;
    } else if (status === "middle") {
        daysUntilDue = Math.ceil(frequency / 2);
    } else {
        daysUntilDue = 0;
    }

    return Task.create({
        name,
        room,
        frequency,
        lastCompletedAt,
        nextDueAt: new Date(new Date(lastCompletedAt).getTime() + daysUntilDue * DAY_IN_MS),
        note,
    });
}

async function updateTask(taskId, { name, frequency, lastCompletedAt, note }) {
    const existingTask = await Task.findById(taskId);
    if (!existingTask) {
        throw new ApiError(404, "Task not found");
    }

    const effectiveFrequency = frequency ?? existingTask.frequency;
    const effectiveLastCompletedAt = lastCompletedAt ?? existingTask.lastCompletedAt;
    const nextDueAt = effectiveLastCompletedAt
        ? new Date(new Date(effectiveLastCompletedAt).getTime() + effectiveFrequency * DAY_IN_MS)
        : undefined;

    return Task.findByIdAndUpdate(
        taskId,
        { name, frequency, lastCompletedAt, nextDueAt, note },
        { new: true, runValidators: true }
    );
}

async function completeTask(taskId, userId) {
    const now = new Date();
    const task = await Task.findById(taskId).populate("room");
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {

            task.lastCompletedAt = now;
            task.nextDueAt = new Date(now.getTime() + task.frequency * DAY_IN_MS);
            await task.save({ session });
            await TaskCompletion.create([{ task: taskId, household: task.room.household, taskName: task.name, roomName: task.room.name, completedBy: user._id, completedAt: now }], { session });
        });
    } finally {
        session.endSession();
    }
    await notificationQueue.add("task-completed", { householdId: task.room.household.toString(), title: task.room.name + " - " + task.name, body: "המשימה בוצעה על ידי " + user.firstName });
    return task;
}

async function deleteTask(taskId) {
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) {
        throw new ApiError(404, "Task not found");
    }
}

module.exports = { getTasks, getTasksPerRoom, createTask, updateTask, completeTask, deleteTask };
