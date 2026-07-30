const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const auth = require("../middleware/auth");

router.use(auth);
router.post("/", ticketController.create);
router.get("/", ticketController.list);
router.get("/:id", ticketController.detail);
router.patch("/:id/status", ticketController.updateStatus);

module.exports = router;
