const express = require("express");
const { getPublicKey, postSubscribePush } = require("../controllers/pushController");
const { validatePushSubscription } = require("../middleware/validate");

const router = express.Router();

router.get("/vapid-public-key", getPublicKey);
router.post("/subscribe", validatePushSubscription, postSubscribePush);

module.exports = router;
