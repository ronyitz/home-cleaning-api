const { notificationQueue } = require("./notificationQueue");

// Registers the recurring jobs. Called once when the server starts.
// upsertJobScheduler is safe to call on every restart: a scheduler with the same id is
// updated, not duplicated, and it only adds a job when the pattern matches (no job on startup).
async function registerSchedulers() {
  // Every day at 08:00 Israel time (cron fields: minute hour day-of-month month day-of-week).
  await notificationQueue.upsertJobScheduler(
    "daily-digest",
    { pattern: "10 12 * * *", tz: "Asia/Jerusalem" },
    { name: "daily-digest" }
  );
}

module.exports = { registerSchedulers };
