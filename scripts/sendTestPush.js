require("dotenv").config();

const mongoose = require("mongoose");
const webpush = require("web-push");
const PushSubscription = require("../src/models/PushSubscription");

// Sends a test notification to every stored push subscription.
// Removes subscriptions the push service reports as gone (404/410).
async function sendTestPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  await mongoose.connect(process.env.MONGO_URI);

  const subscriptions = await PushSubscription.find();
  console.log(`Found ${subscriptions.length} subscription(s).`);

  const payload = JSON.stringify({
    title: "Test notification",
    body: "If you see this, push works end to end.",
    url: "/",
  });

  for (const subscription of subscriptions) {
    const shortEndpoint = subscription.endpoint.slice(0, 60);
    try {
      const result = await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        payload
      );
      console.log(`Sent (${result.statusCode}): ${shortEndpoint}...`);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await subscription.deleteOne();
        console.log(`Gone (${error.statusCode}), deleted: ${shortEndpoint}...`);
      } else {
        console.log(`Failed (${error.statusCode ?? "no status"}): ${shortEndpoint}... ${error.body ?? error.message}`);
      }
    }
  }

  await mongoose.disconnect();
}

sendTestPush().catch((error) => {
  console.error("Test push failed:", error);
  process.exit(1);
});
