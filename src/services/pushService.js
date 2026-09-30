const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Sends a notification to every stored push subscription.
// Removes subscriptions the push service reports as gone (404/410).
// Uses the app's existing mongoose connection - never connects/disconnects here.
async function notifyHousehold(data) {
  const subscriptions = await PushSubscription.find();

  const payload = JSON.stringify({
    title: data?.title,
    body: data?.body,
    url: "/",
  });

  for (const subscription of subscriptions) {
    const shortEndpoint = subscription.endpoint.slice(0, 60);
    try {
      const result = await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        payload,
        { urgency: "high", TTL: 60 }
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
}

module.exports = { notifyHousehold };
