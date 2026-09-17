const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    frequency: {
      type: Number,
      required: true,
      min: 1,
    },
    lastCompletedAt: {
      type: Date,
    },
    nextDueAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["good", "middle", "bad"],
    },
    note: {
      type: String,
    },
  },
  { timestamps: true }
);

TaskSchema.index({ room: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Task", TaskSchema);
