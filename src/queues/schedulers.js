const { notificationQueue } = require("./notificationQueue");

// Registers the recurring jobs. Called once when the server starts.
// upsertJobScheduler is safe to call on every restart: a scheduler with the same id is
// updated, not duplicated, and it only adds a job when the pattern matches (no job on startup).
async function registerSchedulers() {
  // Every Saturday at 21:00 Israel time - always after Shabbat ends, even in summer.
  // Cron fields: minute hour day-of-month month day-of-week (0 = Sunday, 6 = Saturday).
  // The id is still "daily-digest": renaming it would add a second scheduler, not replace this one.
  await notificationQueue.upsertJobScheduler(
    "daily-digest",
    { pattern: "0 17 * * 6", tz: "Asia/Jerusalem" },
    { name: "daily-digest" }
  );
}

module.exports = { registerSchedulers };
