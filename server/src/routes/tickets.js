const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const auth = require("../middleware/auth");

router.use(auth);
router.post("/", ticketController.create);
router.get("/", ticketController.list);
router.get("/assignees", ticketController.listAssignees);
router.get("/stats", ticketController.stats);
router.get("/similar", ticketController.similar);
router.get("/:id", ticketController.detail);
router.patch("/:id/status", ticketController.updateStatus);
router.patch("/:id/transfer", ticketController.transfer);
router.post("/:id/reopen", ticketController.reopen);

module.exports = router;
