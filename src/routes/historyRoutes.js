const express = require("express");
const { getHistory } = require("../controllers/historyController");
const { requireSameHousehold } = require("../middleware/auth");

const router = express.Router();

router.get("/:household", requireSameHousehold, getHistory);

module.exports = router;
