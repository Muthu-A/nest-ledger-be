const express = require("express");
const router = express.Router();

const {
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetList,
  getBudgetSummary
} = require("../controllers/budget.controller");
const auth = require("../middlewares/auth.middleware");

router.post("/", auth, createBudget);
router.put("/:budgetId", auth, updateBudget);
router.delete("/:budgetId", auth, deleteBudget);
router.get("/", auth, getBudgetList);
router.get("/summary", auth, getBudgetSummary);

module.exports = router;
