const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

// Sends a notification to every stored push subscription.
// Removes subscriptions the push service reports as gone (404/410).
// Uses the app's existing mongoose connection - never connects/disconnects here.
async function notifyHousehold(household, data) {
  const subscriptions = await PushSubscription.find({ household: household })


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
        {
          urgency: "high",
          TTL: 60 * 60,
          // Passed per send (not setVapidDetails at load) so requiring this
          // module doesn't crash when VAPID env vars are missing, e.g. in CI.
          vapidDetails: {
            subject: process.env.VAPID_SUBJECT,
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY,
          },
        }
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
