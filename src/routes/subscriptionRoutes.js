const express = require("express");
const { getPublicKey, postSubscribe, postUnsubscribe } = require("../controllers/subscriptionController");
const { validateSubscription, validateDeleteSubscription } = require("../middleware/validation");

const router = express.Router();

router.get("/vapid-public-key", getPublicKey);
router.post("/subscribe", validateSubscription, postSubscribe);
router.post("/unsubscribe", validateDeleteSubscription, postUnsubscribe);

module.exports = router;
