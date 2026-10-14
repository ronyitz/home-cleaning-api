const { Worker } = require("bullmq");
const { connection } = require("../queues/notificationQueue");
const { notifyHousehold } = require("../services/pushService");

function startNotificationWorker() {
    const worker = new Worker("notifications", async (job) => {
        const { title, body, householdId } = job.data;
        await notifyHousehold(householdId, { title, body });
    }, { connection });
    worker.on("failed", (job, error) => console.log(`Job ${job.id} failed: ${error.message}`));
    return worker;
}
module.exports = { startNotificationWorker };
