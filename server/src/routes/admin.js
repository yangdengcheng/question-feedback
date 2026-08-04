const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.use(auth);
router.use(admin);

router.get("/tickets", adminController.listTickets);
router.patch("/tickets/:id", adminController.updateTicket);
router.post("/tickets/batch-delete", adminController.batchDeleteTickets);
router.delete("/tickets/:id", adminController.deleteTicket);
router.get("/users", adminController.listUsers);
router.post("/users", adminController.createUser);
router.post("/users/batch-delete", adminController.batchDeleteUsers);
router.patch("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);

module.exports = router;
