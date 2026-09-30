const express = require("express");
const { getPublicKey, postSubscribePush } = require("../controllers/pushController");

const router = express.Router();

router.get("/vapid-public-key", getPublicKey);
router.post("/subscribe", postSubscribePush);

module.exports = router;
