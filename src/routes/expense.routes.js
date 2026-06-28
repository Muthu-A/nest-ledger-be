const express = require("express");
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
} = require("../controllers/expense.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, getExpenses);
router.post("/", auth, createExpense);
router.put("/:id", auth, updateExpense);
router.delete("/:id", auth, deleteExpense);

module.exports = router;
