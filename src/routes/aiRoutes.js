const express = require("express");
const { postCommand } = require("../controllers/aiController");
const { validateAiCommand } = require("../middleware/validations");

const router = express.Router();

/**
 * @swagger
 * /ai/command:
 *   post:
 *     summary: Find the household tasks that a free-text sentence says were completed
 *     description: Only searches. Completing a task is still done with PATCH /tasks/{taskId}/complete, after the user confirms.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 maxLength: 500
 *                 example: ניקיתי את האסלה באמבטיה של אגם
 *     responses:
 *       200:
 *         description: "{ matches: [...] } - the matching tasks of the user's household (empty when none match)"
 *       422:
 *         description: text is missing, empty or too long
 */
router.post("/command", validateAiCommand, postCommand);

module.exports = router;
