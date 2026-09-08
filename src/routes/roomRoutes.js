const express = require("express");
const { createRoom, getRooms, deleteRoom, updateRoom } = require("../controllers/roomController");

const router = express.Router();


router.post("/", createRoom);
router.get("/", getRooms);
router.delete("/:id", deleteRoom);
router.put("/:id", updateRoom);

module.exports = router;
