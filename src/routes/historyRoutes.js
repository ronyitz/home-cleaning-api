const express = require("express");
const { getHistory } = require("../controllers/historyController");
const { requireSameHousehold } = require("../middleware/authorization");
const { validateHistoryQuery } = require("../middleware/validation");

const router = express.Router();

/**
 * @swagger
 * /history/{household}:
 *   get:
 *     summary: Get the household's task completion history, newest first (up to 100)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: household
 *         required: true
 *         schema:
 *           type: string
 *         description: Must be the household of the logged-in user
 *       - in: query
 *         name: taskId
 *         required: false
 *         schema:
 *           type: string
 *         description: Only completions of this task
 *       - in: query
 *         name: days
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Only completions from the last N days
 *     responses:
 *       200:
 *         description: List of completions, each with the completing user's first and last name
 *       403:
 *         description: Household of another user
 *       422:
 *         description: taskId is not a valid id, or days is not a whole number >= 1
 */
router.get("/:household", requireSameHousehold, validateHistoryQuery, getHistory);

module.exports = router;
