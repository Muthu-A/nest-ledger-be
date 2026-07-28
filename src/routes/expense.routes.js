const express = require("express");
const router = express.Router();
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseDashboard
} = require("../controllers/expense.controller");
const auth = require("../middlewares/auth.middleware");
const monthMiddleware = require("../middlewares/month.middleware");

router.get("/dashboard", auth, monthMiddleware, getExpenseDashboard);
router.get("/", auth, getExpenses);
router.post("/", auth, createExpense);
router.put("/:id", auth, updateExpense);
router.delete("/:id", auth, deleteExpense);

module.exports = router;
