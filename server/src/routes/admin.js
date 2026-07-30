const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.use(auth);
router.use(admin);

router.get("/tickets", adminController.listTickets);
router.patch("/tickets/:id", adminController.updateTicket);
router.get("/notify-rules", adminController.listNotifyRules);
router.post("/notify-rules", adminController.createNotifyRule);
router.patch("/notify-rules/:id", adminController.updateNotifyRule);
router.delete("/notify-rules/:id", adminController.deleteNotifyRule);
router.get("/users", adminController.listUsers);
router.post("/users", adminController.createUser);
router.patch("/users/:id", adminController.updateUser);

module.exports = router;
