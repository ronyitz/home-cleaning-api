const mongoose = require("mongoose");
const ROOM_TYPES = require("../constants/roomTypes");

const ROOM_TYPE_VALUES = ROOM_TYPES.map((t) => t.value);

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 1,
    },
    type: {
      type: String,
      required: true,
      enum: ROOM_TYPE_VALUES,
    },
    household: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Household",
      required: true,
    },
  },

  { timestamps: true, collection: "rooms" }
);

roomSchema.index({ household: 1, name: 1 }, { unique: true });


module.exports = mongoose.model("Room", roomSchema);
