const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder
} = require("../controllers/reminder.controller");

router.get("/", auth, getReminders);
router.post("/", auth, createReminder);
router.patch("/:id", auth, updateReminder);
router.delete("/:id", auth, deleteReminder);

module.exports = router;
