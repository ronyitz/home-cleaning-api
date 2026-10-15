const mongoose = require("mongoose");

// One document per completion of a task - the history of who did what and when.
// Names are copied at completion time, so the history still makes sense
// after the task or room is renamed or deleted.
const TaskCompletionSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    household: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Household",
      required: true,
    },
    taskName: {
      type: String,
    },
    roomName: {
      type: String,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",

    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// History is read per household, newest first ("what was done this week").
TaskCompletionSchema.index({ household: 1, completedAt: -1 });

module.exports = mongoose.model("TaskCompletion", TaskCompletionSchema);
