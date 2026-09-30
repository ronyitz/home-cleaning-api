const PushSubscription = require("../models/PushSubscription");


// GET /api/push/vapid-public-key
function getPublicKey(req, res) {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}

async function postSubscribePush(req, res){
    const pushSubscription = await PushSubscription.findOneAndUpdate({ endpoint: req.body.endpoint},{keys: req.body.keys, user: req.userId, household: req.householdId },  { upsert: true, new: true, runValidators: true } );
    res.status(200).json(pushSubscription);
}



module.exports = { getPublicKey, postSubscribePush };
