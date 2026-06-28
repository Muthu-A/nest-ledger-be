const Goal = require("../models/Goal");
const Contribution = require("../models/Contribution");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");

// Create Goal
exports.createGoal = async (req, res) => {
  try {
    const { goalName, category, targetAmount, currentAmount, targetDate, notes } = req.body;

    if (!goalName || !category || !targetAmount || !targetDate) {
      return res.status(400).json({
        success: false,
        message: "goalName, category, targetAmount, and targetDate are required"
      });
    }

    const payload = {
      goalName,
      category,
      targetAmount,
      currentAmount: currentAmount || 0,
      targetDate: new Date(targetDate),
      notes,
      status: "ACTIVE"
    };
    if (req.user && req.user.familyId) payload.familyId = req.user.familyId;
    if (req.user && req.user.id) payload.createdBy = req.user.id;

    const goal = await Goal.create(payload);

    if (payload.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(payload.familyId, "goal-created", { data: goal, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "created goal", goal.goalName);
      socketService.emitToFamily(payload.familyId, "activity-created", { message: msg, meta: { type: "goal", goalId: goal._id }, actor });
    }

    res.status(201).json({
      success: true,
      message: "Goal created successfully",
      data: {
        goalId: goal._id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create goal"
    });
  }
};

// Get All Goals
exports.getAllGoals = async (req, res) => {
  try {
    const goals = await Goal.find().sort({ createdAt: -1 });

    const goalsWithProgress = goals.map((goal) => {
      const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
      const remainingAmount = goal.targetAmount - goal.currentAmount;

      return {
        goalId: goal._id,
        goalName: goal.goalName,
        category: goal.category,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        progress,
        remainingAmount,
        targetDate: goal.targetDate,
        status: goal.status
      };
    });

    res.json({
      success: true,
      data: goalsWithProgress
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goals"
    });
  }
};

// Get Goal Details
exports.getGoalDetails = async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await Goal.findById(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
    const remainingAmount = goal.targetAmount - goal.currentAmount;

    res.json({
      success: true,
      data: {
        goalId: goal._id,
        goalName: goal.goalName,
        category: goal.category,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        remainingAmount,
        progress,
        targetDate: goal.targetDate,
        notes: goal.notes,
        status: goal.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goal details"
    });
  }
};

// Update Goal
exports.updateGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { goalName, targetAmount, targetDate, notes } = req.body;

    const goal = await Goal.findById(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    if (goalName) goal.goalName = goalName;
    if (targetAmount) goal.targetAmount = targetAmount;
    if (targetDate) goal.targetDate = new Date(targetDate);
    if (notes !== undefined) goal.notes = notes;

    await goal.save();

    // emit
    if (req.user && req.user.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(req.user.familyId, "goal-updated", { data: goal, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "updated goal", goal.goalName);
      socketService.emitToFamily(req.user.familyId, "activity-created", { message: msg, meta: { type: "goal", goalId: goal._id }, actor });
    }

    res.json({
      success: true,
      message: "Goal updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update goal"
    });
  }
};

// Delete Goal
exports.deleteGoal = async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await Goal.findByIdAndDelete(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    // Delete all contributions related to this goal
    await Contribution.deleteMany({ goalId });

    if (req.user && req.user.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(req.user.familyId, "goal-deleted", { id: goal._id, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "deleted goal", goal.goalName);
      socketService.emitToFamily(req.user.familyId, "activity-created", { message: msg, meta: { type: "goal", goalId: goal._id }, actor });
    }

    res.json({
      success: true,
      message: "Goal deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete goal"
    });
  }
};

// Add Contribution
exports.addContribution = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { amount, date, notes } = req.body;

    if (!amount || !date) {
      return res.status(400).json({
        success: false,
        message: "amount and date are required"
      });
    }

    const goal = await Goal.findById(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    // Create contribution
    const payload = { goalId, amount, date: new Date(date), notes };
    const contribution = await Contribution.create(payload);

    // Update goal current amount
    goal.currentAmount += amount;

    // Check if goal is completed
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = "COMPLETED";
    }

    await goal.save();

    // emit contribution added
    if (req.user && req.user.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(req.user.familyId, "goal-contribution-added", { data: contribution, goalId, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "contributed", goal.goalName, amount);
      socketService.emitToFamily(req.user.familyId, "activity-created", { message: msg, meta: { type: "goal-contribution", goalId, contributionId: contribution._id }, actor });
    }

    res.status(201).json({
      success: true,
      message: "Contribution added successfully",
      data: {
        contributionId: contribution._id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to add contribution"
    });
  }
};

// Get Contribution History
exports.getContributionHistory = async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await Goal.findById(goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    const contributions = await Contribution.find({ goalId }).sort({ date: -1 });

    const formattedContributions = contributions.map((contrib) => ({
      contributionId: contrib._id,
      amount: contrib.amount,
      date: contrib.date,
      notes: contrib.notes
    }));

    res.json({
      success: true,
      data: formattedContributions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contribution history"
    });
  }
};

// Update Contribution
exports.updateContribution = async (req, res) => {
  try {
    const { contributionId } = req.params;
    const { amount, notes } = req.body;

    const contribution = await Contribution.findById(contributionId);

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: "Contribution not found"
      });
    }

    const goal = await Goal.findById(contribution.goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    // Calculate difference and update goal amount
    const oldAmount = contribution.amount;
    const newAmount = amount || oldAmount;
    const difference = newAmount - oldAmount;

    goal.currentAmount += difference;

    // Check if goal is completed or needs status update
    if (goal.currentAmount >= goal.targetAmount && goal.status === "ACTIVE") {
      goal.status = "COMPLETED";
    } else if (goal.currentAmount < goal.targetAmount && goal.status === "COMPLETED") {
      goal.status = "ACTIVE";
    }

    await goal.save();

    // emit contribution updated
    if (req.user && req.user.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(req.user.familyId, "goal-contribution-updated", { data: contribution, goalId: contribution.goalId, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "updated contribution for", goal.goalName, contribution.amount);
      socketService.emitToFamily(req.user.familyId, "activity-created", { message: msg, meta: { type: "goal-contribution", goalId: contribution.goalId, contributionId: contribution._id }, actor });
    }

    // Update contribution
    if (amount) contribution.amount = amount;
    if (notes !== undefined) contribution.notes = notes;

    await contribution.save();

    res.json({
      success: true,
      message: "Contribution updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update contribution"
    });
  }
};

// Delete Contribution
exports.deleteContribution = async (req, res) => {
  try {
    const { contributionId } = req.params;

    const contribution = await Contribution.findById(contributionId);

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: "Contribution not found"
      });
    }

    const goal = await Goal.findById(contribution.goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Goal not found"
      });
    }

    // Subtract contribution amount from goal
    goal.currentAmount -= contribution.amount;

    // Update status if needed
    if (goal.currentAmount < goal.targetAmount && goal.status === "COMPLETED") {
      goal.status = "ACTIVE";
    }

    await goal.save();

    // Delete contribution
    await Contribution.findByIdAndDelete(contributionId);

    if (req.user && req.user.familyId) {
      const actor = { id: req.user ? req.user.id : null, name: req.user ? req.user.name : null };
      socketService.emitToFamily(req.user.familyId, "goal-contribution-deleted", { contributionId, goalId: contribution.goalId, actor });
      const msg = makeActivityMessage(req.user ? req.user.name : "Someone", "removed contribution for", goal.goalName, contribution.amount);
      socketService.emitToFamily(req.user.familyId, "activity-created", { message: msg, meta: { type: "goal-contribution", goalId: contribution.goalId, contributionId }, actor });
    }

    res.json({
      success: true,
      message: "Contribution removed"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contribution"
    });
  }
};

// Goal Dashboard Summary
exports.getGoalSummary = async (req, res) => {
  try {
    const goals = await Goal.find();

    const totalGoals = goals.length;
    const activeGoals = goals.filter((g) => g.status === "ACTIVE").length;
    const completedGoals = goals.filter((g) => g.status === "COMPLETED").length;

    const totalTargetAmount = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const totalSavedAmount = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);

    const overallProgress = totalTargetAmount > 0 
      ? Math.round((totalSavedAmount / totalTargetAmount) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalGoals,
        activeGoals,
        completedGoals,
        totalTargetAmount,
        totalSavedAmount,
        overallProgress
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch goal summary"
    });
  }
};
