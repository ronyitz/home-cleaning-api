const aiService = require("../services/aiService");

// POST /api/ai/command
async function postCommand(req, res) {
  const matches = await aiService.matchTasks(req.householdId, req.body.text);
  res.status(200).json({ matches });
}

module.exports = { postCommand };
