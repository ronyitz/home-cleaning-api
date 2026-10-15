const { Worker } = require("bullmq");
const { connection, notificationQueue } = require("../queues/notificationQueue");
const Subscription = require("../models/Subscription");
const { notifySubscription } = require("../services/subscriptionService");


function startNotificationWorker() {
    const worker = new Worker("notifications", async (job) => {
        if (job.name === "task-completed") {
            const subscriptions = await Subscription.find({ household: job.data.householdId })
            for (let i = 0; i < subscriptions.length; i++) {
                await notificationQueue.add("send-push", {subscriptionId: subscriptions[i]._id, ...job.data})
            }
        } else if (job.name === "send-push") {
            const { title, body, subscriptionId } = job.data;
            await notifySubscription(subscriptionId, { title, body });
        }
    }, { connection });
    worker.on("failed", (job, error) => console.log(`Job ${job.id} failed: ${error.message}`));
    return worker;
}
module.exports = { startNotificationWorker };
