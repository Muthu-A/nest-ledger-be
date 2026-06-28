const express = require("express");
const router = express.Router();
const {
  createGoal,
  getAllGoals,
  getGoalDetails,
  updateGoal,
  deleteGoal,
  addContribution,
  getContributionHistory,
  updateContribution,
  deleteContribution,
  getGoalSummary
} = require("../controllers/goal.controller");

const auth = require("../middlewares/auth.middleware");

// Goal endpoints
router.post("/", auth, createGoal);
router.get("/", auth, getAllGoals);
router.get("/summary", auth, getGoalSummary);
router.get("/:goalId", auth, getGoalDetails);
router.put("/:goalId", auth, updateGoal);
router.delete("/:goalId", auth, deleteGoal);

// Contribution endpoints
router.post("/:goalId/contributions", auth, addContribution);
router.get("/:goalId/contributions", auth, getContributionHistory);
router.put("/contributions/:contributionId", auth, updateContribution);
router.delete("/contributions/:contributionId", auth, deleteContribution);

module.exports = router;
