const { Worker } = require("bullmq");
const { connection, notificationQueue } = require("../queues/notificationQueue");
const Subscription = require("../models/Subscription");
const { getTasks } = require("../services/taskService");
const { notifySubscription } = require("../services/subscriptionService");


function startNotificationWorker() {
    const worker = new Worker("notifications", async (job) => {
        if (job.name === "task-completed") {
            const subscriptions = await Subscription.find({ household: job.data.householdId })
            for (let i = 0; i < subscriptions.length; i++) {
                await notificationQueue.add("send-push", { subscriptionId: subscriptions[i]._id, ...job.data })
            }
        } else if (job.name === "send-push") {
            const { title, body, subscriptionId } = job.data;
            await notifySubscription(subscriptionId, { title, body });
        } else if (job.name === "daily-digest") {
            const householdIds = await Subscription.distinct("household");
            await notificationQueue.addBulk(
                householdIds.map((householdId) => ({
                    name: "household-digest",
                    data: { householdId },
                }))
            );
        } else if (job.name === "household-digest") {
            const tasks = await getTasks(job.data.householdId, 7);
            if (tasks.length === 0) return;
            const title = tasks.length === 1
                ? "משימה אחת לשבוע הקרוב"
                : `${tasks.length} משימות לשבוע הקרוב`;
            const body = tasks.map((task) => `${task.name} (${task.room.name})`).join("\n");
            const subscriptions = await Subscription.find({ household: job.data.householdId });
            await notificationQueue.addBulk(
                subscriptions.map((subscription) => ({
                    name: "send-push",
                    data: { subscriptionId: subscription._id, title, body: body }
                }))
            )
        }
    }, { connection });
    worker.on("failed", (job, error) => console.log(`Job ${job.id} failed: ${error.message}`));
    return worker;
}
module.exports = { startNotificationWorker };
