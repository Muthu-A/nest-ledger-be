const investmentService = require("../services/investment.service");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");

/**
 * Create a new investment
 */
exports.createInvestment = async (req, res) => {
  try {
    const { investmentName, category, amountInvested, currentValue, platform, frequency, purchaseDate, reminderEnabled, reminderDate, notes } = req.body;

    // Validation
    if (!investmentName || !category || amountInvested == null || currentValue == null || !frequency || !purchaseDate) {
      return res.status(400).json({
        message: "investmentName, category, amountInvested, currentValue, frequency, and purchaseDate are required"
      });
    }

    if (amountInvested < 0 || currentValue < 0) {
      return res.status(400).json({
        message: "Amount values cannot be negative"
      });
    }

    if (isNaN(new Date(purchaseDate).getTime())) {
      return res.status(400).json({
        message: "Invalid purchaseDate format"
      });
    }

    if (reminderEnabled && !reminderDate) {
      return res.status(400).json({
        message: "reminderDate is required when reminderEnabled is true"
      });
    }

    if (reminderDate && isNaN(new Date(reminderDate).getTime())) {
      return res.status(400).json({
        message: "Invalid reminderDate format"
      });
    }

    const payload = {
      familyId: req.user.familyId,
      userId: req.user._id,
      investmentName: investmentName.trim(),
      category,
      amountInvested,
      currentValue,
      platform: platform?.trim() || null,
      frequency,
      purchaseDate: new Date(purchaseDate),
      reminderEnabled: reminderEnabled || false,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      notes: notes?.trim() || null,
      status: "ACTIVE"
    };

    const investment = await investmentService.createInvestment(payload);

    // Emit socket event
    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:created",
      {
        investment,
        message: makeActivityMessage(`Investment "${investmentName}" created`, req.user.name)
      }
    );

    res.status(201).json({
      message: "Investment created successfully",
      investment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to create investment" });
  }
};

/**
 * Get all investments with pagination, search, sorting, filtering
 */
exports.getInvestments = async (req, res) => {
  try {
    const { page, limit, search, category, status, frequency, sortBy, order } = req.query;

    const query = {};
    if (page) query.page = parseInt(page);
    if (limit) query.limit = parseInt(limit);
    if (search) query.search = search;
    if (category) query.category = category;
    if (status) query.status = status;
    if (frequency) query.frequency = frequency;
    if (sortBy) query.sortBy = sortBy;
    if (order) query.order = order;

    const result = await investmentService.getInvestments(req.user.familyId, query);

    res.json({
      message: "Investments fetched successfully",
      ...result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch investments" });
  }
};

/**
 * Get single investment by ID
 */
exports.getInvestmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const investment = await investmentService.getInvestmentById(id, req.user.familyId);

    res.json({
      message: "Investment fetched successfully",
      investment
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || "Failed to fetch investment" });
  }
};

/**
 * Update investment
 */
exports.updateInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const { investmentName, category, amountInvested, currentValue, platform, frequency, purchaseDate, reminderEnabled, reminderDate, notes, status } = req.body;

    // Validation
    if (amountInvested != null && amountInvested < 0) {
      return res.status(400).json({
        message: "Amount values cannot be negative"
      });
    }

    if (currentValue != null && currentValue < 0) {
      return res.status(400).json({
        message: "Current value cannot be negative"
      });
    }

    if (purchaseDate && isNaN(new Date(purchaseDate).getTime())) {
      return res.status(400).json({
        message: "Invalid purchaseDate format"
      });
    }

    if (reminderEnabled && !reminderDate) {
      return res.status(400).json({
        message: "reminderDate is required when reminderEnabled is true"
      });
    }

    if (reminderDate && isNaN(new Date(reminderDate).getTime())) {
      return res.status(400).json({
        message: "Invalid reminderDate format"
      });
    }

    const updates = {};
    if (investmentName) updates.investmentName = investmentName.trim();
    if (category) updates.category = category;
    if (amountInvested != null) updates.amountInvested = amountInvested;
    if (currentValue != null) updates.currentValue = currentValue;
    if (platform) updates.platform = platform.trim();
    if (frequency) updates.frequency = frequency;
    if (purchaseDate) updates.purchaseDate = new Date(purchaseDate);
    if (reminderEnabled != null) updates.reminderEnabled = reminderEnabled;
    if (reminderDate) updates.reminderDate = new Date(reminderDate);
    if (notes != null) updates.notes = notes.trim();
    if (status) updates.status = status;

    const investment = await investmentService.updateInvestment(id, req.user.familyId, req.user._id, updates);

    // Emit socket event
    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:updated",
      {
        investment,
        message: makeActivityMessage(`Investment "${investment.investmentName}" updated`, req.user.name)
      }
    );

    res.json({
      message: "Investment updated successfully",
      investment
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || "Failed to update investment" });
  }
};

/**
 * Delete investment (soft delete)
 */
exports.deleteInvestment = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await investmentService.deleteInvestment(id, req.user.familyId, req.user._id);

    // Emit socket event
    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:deleted",
      {
        investmentId: id,
        message: makeActivityMessage("Investment deleted", req.user.name)
      }
    );

    res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || "Failed to delete investment" });
  }
};

/**
 * Get dashboard metrics
 */
exports.getDashboard = async (req, res) => {
  try {
    const metrics = await investmentService.getDashboardMetrics(req.user.familyId);

    res.json({
      message: "Dashboard metrics fetched successfully",
      ...metrics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch dashboard metrics" });
  }
};

/**
 * Get allocation by category
 */
exports.getAllocation = async (req, res) => {
  try {
    const allocation = await investmentService.getAllocation(req.user.familyId);

    res.json({
      message: "Allocation fetched successfully",
      allocation
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch allocation" });
  }
};

/**
 * Get monthly trend
 */
exports.getMonthlyTrend = async (req, res) => {
  try {
    const { months = 12 } = req.query;

    const trend = await investmentService.getMonthlyTrend(req.user.familyId, parseInt(months));

    res.json({
      message: "Monthly trend fetched successfully",
      trend
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch monthly trend" });
  }
};

/**
 * Get recent investments
 */
exports.getRecentInvestments = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const investments = await investmentService.getRecentInvestments(req.user.familyId, parseInt(limit));

    res.json({
      message: "Recent investments fetched successfully",
      investments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch recent investments" });
  }
};

/**
 * Get upcoming reminders
 */
exports.getUpcomingReminders = async (req, res) => {
  try {
    const reminders = await investmentService.getUpcomingReminders(req.user.familyId);

    res.json({
      message: "Upcoming reminders fetched successfully",
      reminders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch upcoming reminders" });
  }
};

/**
 * Get statistics
 */
exports.getStatistics = async (req, res) => {
  try {
    const statistics = await investmentService.getStatistics(req.user.familyId);

    res.json({
      message: "Statistics fetched successfully",
      statistics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch statistics" });
  }
};

/**
 * Duplicate investment
 */
exports.duplicateInvestment = async (req, res) => {
  try {
    const { id } = req.params;

    const investment = await investmentService.duplicateInvestment(id, req.user.familyId, req.user._id);

    // Emit socket event
    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:duplicated",
      {
        investment,
        message: makeActivityMessage(`Investment "${investment.investmentName}" created`, req.user.name)
      }
    );

    res.status(201).json({
      message: "Investment duplicated successfully",
      investment
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || "Failed to duplicate investment" });
  }
};
