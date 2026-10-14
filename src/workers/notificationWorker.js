const { Worker } = require("bullmq");
const { connection, notificationQueue } = require("../queues/notificationQueue");
const PushSubscription = require("../models/PushSubscription");
const { notifySubscription } = require("../services/pushService");


function startNotificationWorker() {
    const worker = new Worker("notifications", async (job) => {
        if (job.name === "task-completed") {
            const subscriptions = await PushSubscription.find({ household: job.data.householdId })
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
