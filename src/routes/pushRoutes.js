const express = require("express");
const { getPublicKey, postSubscribePush, postUnsubscribe } = require("../controllers/pushController");
const { validatePushSubscription, validateDeleteSubscription } = require("../middleware/validate");

const router = express.Router();

router.get("/vapid-public-key", getPublicKey);
router.post("/subscribe", validatePushSubscription, postSubscribePush);
router.post("/unsubscribe", validateDeleteSubscription, postUnsubscribe);

module.exports = router;
