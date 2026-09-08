const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
  },
  { timestamps: true, collection: "rooms" }
);

module.exports = mongoose.model("Room", roomSchema);
