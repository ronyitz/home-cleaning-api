const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
    type: {
      type: String,
    },
  },
  { timestamps: true, collection: "rooms" }
);

module.exports = mongoose.model("Room", roomSchema);
