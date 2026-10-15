const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
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
SubscriptionSchema.index({ household: 1 });

// Explicit collection name: the model used to be called PushSubscription, and existing
// documents live in "pushsubscriptions". Without it, mongoose would use "subscriptions".
module.exports = mongoose.model("Subscription", SubscriptionSchema, "pushsubscriptions");
