const { notificationQueue } = require("./notificationQueue");

// Registers the recurring jobs. Called once when the server starts.
// upsertJobScheduler is safe to call on every restart: a scheduler with the same id is
// updated, not duplicated, and it only adds a job when the pattern matches (no job on startup).
async function registerSchedulers() {
  // Every day at 21:00 Israel time.
  // Cron fields: minute hour day-of-month month day-of-week (0 = Sunday, 6 = Saturday).
  await notificationQueue.upsertJobScheduler(
    "daily-digest",
    { pattern: "0 21 * * *", tz: "Asia/Jerusalem" },
    { name: "daily-digest" }
  );
}

module.exports = { registerSchedulers };
