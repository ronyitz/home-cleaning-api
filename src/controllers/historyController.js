const historyService = require("../services/historyService");

// GET /api/history/:household
async function getHistory(req, res) {
  const history = await historyService.getHistory(req.params.household);
  res.status(200).json(history);
}

module.exports = { getHistory };
