require("dotenv").config();

const mongoose = require("mongoose");
const Room = require("../src/models/Room");
const Task = require("../src/models/Task");

async function cleanupOrphanedTasks() {
  await mongoose.connect(process.env.MONGO_URI);

  const existingRoomIds = await Room.find().distinct("_id");

  const result = await Task.deleteMany({ room: { $nin: existingRoomIds } });

  console.log(`Deleted ${result.deletedCount} orphaned task(s).`);

  await mongoose.disconnect();
}

cleanupOrphanedTasks().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
