const webpush = require("web-push");
const { UnrecoverableError } = require("bullmq");
const Subscription = require("../models/Subscription");
const logger = require("../config/logger");

// Sends a notification to one push subscription (one device).
// Skips it if the subscription was removed meanwhile (e.g. the user logged out).
// Deletes it when the push service reports it as gone (404/410).
// Throws UnrecoverableError on 400/401/403/413 (a bug in our request - retrying won't help),
// so the job fails right away. Throws on other errors, so the queue retries the job.
// Uses the app's existing mongoose connection - never connects/disconnects here.
async function notifySubscription(subscriptionId, data) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    return;
  }

  const payload = JSON.stringify({
    title: data?.title,
    body: data?.body,
    url: "/",
  });

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
    logger.info({ userId: subscription.user, statusCode: result.statusCode, endpoint: shortEndpoint }, "push sent");
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await subscription.deleteOne();
      logger.info({ userId: subscription.user, statusCode: error.statusCode, endpoint: shortEndpoint }, "push subscription gone, deleted");
    } else {
      logger.warn({ userId: subscription.user, statusCode: error.statusCode, endpoint: shortEndpoint, body: error.body, err: error }, "push failed");
      if ([400, 401, 403, 413].includes(error.statusCode)) {
        throw new UnrecoverableError(`Push rejected (${error.statusCode}): ${error.body ?? error.message}`);
      }
      throw error;
    }
  }
}

module.exports = { notifySubscription };
