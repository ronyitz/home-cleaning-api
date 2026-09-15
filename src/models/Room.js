const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      minlength: 1,
    },
    type: {
      type: String,
      required: true,
      enum: ["living_room", "kitchen","office", "bedroom", "other"],
    },
  },
  { timestamps: true, collection: "rooms" }
);

module.exports = mongoose.model("Room", roomSchema);
