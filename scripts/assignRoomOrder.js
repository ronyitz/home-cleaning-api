// One-time migration: gives every existing room an `order` number within its household.
// Rooms are numbered 1, 2, 3... by creation date, so the current order on screen is kept.
// Households whose rooms all have an order already are skipped, so it is safe to run again.
//
// Preview without saving:  node scripts/assignRoomOrder.js --dry-run
// Run for real:            node scripts/assignRoomOrder.js
require("dotenv").config();

const mongoose = require("mongoose");
const Room = require("../src/models/Room");

const DRY_RUN = process.argv.includes("--dry-run");

async function assignRoomOrder() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}${DRY_RUN ? " (dry run, nothing will be saved)" : ""}`);

  const householdIds = await Room.distinct("household");
  let updatedCount = 0;

  for (const householdId of householdIds) {
    const rooms = await Room.find({ household: householdId }).sort({ createdAt: 1 });

    if (rooms.every((room) => typeof room.order === "number")) {
      console.log(`Household ${householdId}: already ordered, skipped.`);
      continue;
    }

    for (let i = 0; i < rooms.length; i++) {
      const order = i + 1;
      console.log(`Household ${householdId}: ${order}. ${rooms[i].name}`);
      if (!DRY_RUN) {
        await Room.updateOne({ _id: rooms[i]._id }, { $set: { order } });
      }
      updatedCount++;
    }
  }

  console.log(`${DRY_RUN ? "Would update" : "Updated"} ${updatedCount} room(s) in ${householdIds.length} household(s).`);

  await mongoose.disconnect();
}

assignRoomOrder().catch((error) => {
  console.error("Assigning room order failed:", error);
  process.exit(1);
});
