const TaskCompletion = require("../models/TaskCompletion");

const HISTORY_LIMIT = 100;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Returns the household's task completions, newest first.
async function getHistory(householdId, taskId, days) {
    const filter = { household: householdId };
    if (taskId) {
        filter.task = taskId;
    }
    if (days) {
        filter.completedAt = { $gte: new Date(Date.now() - Number(days) * DAY_IN_MS) };
    }
    return TaskCompletion.find(filter).populate("completedBy", "firstName lastName").sort({ completedAt: -1 })
        .limit(HISTORY_LIMIT);
};



module.exports = { getHistory };
