const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    household: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Household",
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
  },
  { timestamps: true }
);

// Notifications are sent per household, so look subscriptions up by household.
PushSubscriptionSchema.index({ household: 1 });

module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);
