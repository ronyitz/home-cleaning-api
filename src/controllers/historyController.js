const historyService = require("../services/historyService");

// GET /api/history/:household?taskId=...&days=...
async function getHistory(req, res) {
  const history = await historyService.getHistory(req.params.household, req.query.taskId, req.query.days);
  res.status(200).json(history);
}

module.exports = { getHistory };
