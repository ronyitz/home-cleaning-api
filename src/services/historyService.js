const TaskCompletion = require("../models/TaskCompletion");

const HISTORY_LIMIT = 100;

// Returns the household's task completions, newest first.
async function getHistory(householdId) {
    return TaskCompletion.find({ household: householdId }).populate("completedBy", "firstName lastName")
        .sort({ completedAt: -1 })
        .limit(HISTORY_LIMIT);
}

module.exports = { getHistory };
