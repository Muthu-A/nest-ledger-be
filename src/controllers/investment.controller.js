const investmentService = require("../services/investment.service");
const socketService = require("../services/socketService");
const { makeActivityMessage } = require("../socket/socketEvents");
const InvestmentCategory = require("../models/InvestmentCategory");

const CATEGORY_MAP = {
  gold: "Gold",
  mutualfund: "MutualFund",
  "mutual fund": "MutualFund",
  sip: "SIP",
  stocks: "Stocks",
  fd: "FD",
  rd: "RD",
  ppf: "PPF",
  epf: "EPF",
  crypto: "Crypto",
  realestate: "RealEstate",
  "real estate": "RealEstate",
  emergencyfund: "EmergencyFund",
  "emergency fund": "EmergencyFund",
  others: "Others"
};

const FREQUENCY_MAP = {
  onetime: "OneTime",
  "one time": "OneTime",
  "one-time": "OneTime",
  monthly: "Monthly",
  quarterly: "Quarterly",
  halfyearly: "HalfYearly",
  "half-yearly": "HalfYearly",
  "half yearly": "HalfYearly",
  yearly: "Yearly"
};

function normalizeCategory(category) {
  if (category === undefined || category === null) return null;
  const normalized = category.toString().trim();
  const key = normalized.toLowerCase().replace(/\s+/g, " ");
  return CATEGORY_MAP[key] || normalized;
}

function normalizeFrequency(frequency) {
  if (frequency === undefined || frequency === null) return null;
  const normalized = frequency.toString().trim();
  const key = normalized.toLowerCase().replace(/\s+/g, " ");
  return FREQUENCY_MAP[key] || normalized;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1 || value === "on" || value === "yes";
}

/**
 * Create a new investment
 */
exports.createInvestment = async (req, res) => {
  try {
    const { investmentName, category, amountInvested, currentValue, platform, frequency, purchaseDate, reminderEnabled: reminderEnabledRaw, reminderDate, notes } = req.body;

    const normalizedCategory = normalizeCategory(category);
    const normalizedFrequency = normalizeFrequency(frequency);
    const reminderEnabled = parseBoolean(reminderEnabledRaw);

    // Validation
    if (!investmentName || !normalizedCategory || amountInvested == null || currentValue == null || !normalizedFrequency || !purchaseDate) {
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
      category: normalizedCategory,
      amountInvested,
      currentValue,
      platform: platform?.trim() || null,
      frequency: normalizedFrequency,
      purchaseDate: new Date(purchaseDate),
      reminderEnabled,
      reminderDate: reminderEnabled && reminderDate ? new Date(reminderDate) : null,
      notes: notes?.trim() || null,
      status: "ACTIVE"
    };

    const investment = await investmentService.createInvestment(payload);

    const actor = { id: req.user._id, name: req.user.name };

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:created",
      {
        investment,
        actor
      }
    );

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "activity-created",
      {
        message: makeActivityMessage(req.user.name, "created", investment.investmentName, investment.amountInvested),
        meta: { type: "investment", investmentId: investment._id },
        actor
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
    const { page, limit, search, category, status, frequency, sortBy, order, raw } = req.query;

    const query = {};
    if (page) query.page = parseInt(page);
    if (limit) query.limit = parseInt(limit);
    if (search) query.search = search;
    if (category) query.category = normalizeCategory(category);
    if (status) query.status = status;
    if (frequency) query.frequency = normalizeFrequency(frequency);
    if (sortBy) query.sortBy = sortBy;
    if (order) query.order = order;

    const result = await investmentService.getInvestments(req.user.familyId, query, raw === "true");

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
 * Get investment history for a category
 */
exports.getInvestmentHistory = async (req, res) => {
  try {
    const { category, page, limit, search, frequency, status, sortBy, order } = req.query;

    if (!category) {
      return res.status(400).json({ message: "category is required" });
    }

    const query = {};
    if (page) query.page = parseInt(page);
    if (limit) query.limit = parseInt(limit);
    if (search) query.search = search;
    if (frequency) query.frequency = normalizeFrequency(frequency);
    if (status) query.status = status;
    if (sortBy) query.sortBy = sortBy;
    if (order) query.order = order;

    const normalizedCategory = normalizeCategory(category);
    const result = await investmentService.getInvestmentHistory(req.user.familyId, normalizedCategory, query);

    res.json({
      message: "Investment history fetched successfully",
      ...result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to fetch investment history" });
  }
};

exports.getInvestmentHistoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, search, frequency, status, sortBy, order } = req.query;

    const query = {};
    if (page) query.page = parseInt(page);
    if (limit) query.limit = parseInt(limit);
    if (search) query.search = search;
    if (frequency) query.frequency = normalizeFrequency(frequency);
    if (status) query.status = status;
    if (sortBy) query.sortBy = sortBy;
    if (order) query.order = order;

    const result = await investmentService.getInvestmentHistoryById(id, req.user.familyId, query);

    // Return only required fields: category, purchaseDate, amountInvested
    const investments = (result.investments || []).map((inv) => ({
      category: inv.category,
      purchaseDate: inv.purchaseDate,
      amountInvested: inv.amountInvested,
    }));

    res.json({
      message: "Investment history fetched successfully",
      investments,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error(error);
    if (error.message.includes("not found") || error.message.includes("Invalid investment ID")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || "Failed to fetch investment history" });
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
    const { investmentName, category, amountInvested, currentValue, platform, frequency, purchaseDate, reminderEnabled: reminderEnabledRaw, reminderDate, notes, status } = req.body;

    const normalizedCategory = category ? normalizeCategory(category) : null;
    const normalizedFrequency = frequency ? normalizeFrequency(frequency) : null;
    const reminderEnabled = reminderEnabledRaw !== undefined && reminderEnabledRaw !== null ? parseBoolean(reminderEnabledRaw) : null;

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
    if (normalizedCategory) updates.category = normalizedCategory;
    if (amountInvested != null) updates.amountInvested = amountInvested;
    if (currentValue != null) updates.currentValue = currentValue;
    if (platform) updates.platform = platform.trim();
    if (normalizedFrequency) updates.frequency = normalizedFrequency;
    if (purchaseDate) updates.purchaseDate = new Date(purchaseDate);
    if (reminderEnabled !== null) {
      updates.reminderEnabled = reminderEnabled;
      if (!reminderEnabled) {
        updates.reminderDate = null;
      }
    }
    if (reminderDate) {
      updates.reminderDate = new Date(reminderDate);
    }
    if (notes != null) updates.notes = notes.trim();
    if (status) updates.status = status;

    const investment = await investmentService.updateInvestment(id, req.user.familyId, req.user._id, updates);

    const actor = { id: req.user._id, name: req.user.name };

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:updated",
      {
        investment,
        actor
      }
    );

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "activity-created",
      {
        message: makeActivityMessage(req.user.name, "updated", investment.investmentName, investment.amountInvested),
        meta: { type: "investment", investmentId: investment._id },
        actor
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

    const actor = { id: req.user._id, name: req.user.name };

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:deleted",
      {
        investmentId: id,
        actor
      }
    );

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "activity-created",
      {
        message: makeActivityMessage(req.user.name, "deleted", "investment"),
        meta: { type: "investment", investmentId: id },
        actor
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
 * Deactivate an investment category for the family (invested amounts remain intact)
 */
exports.deactivateCategory = async (req, res) => {
  try {
    const { category } = req.body;
    if (!category || String(category).trim() === "") {
      return res.status(400).json({ message: "category is required" });
    }
    const familyId = req.user.familyId;
    const name = category.toString().trim();

    const updated = await InvestmentCategory.findOneAndUpdate(
      { familyId, name },
      { $set: { active: false } },
      { upsert: true, new: true }
    );

    // Optionally emit socket event to family about category deactivation
    try {
      socketService.emitToFamily(familyId.toString(), 'investment:category:deactivated', { category: name });
    } catch (e) {
      // ignore socket errors
    }

    return res.json({ message: 'Category deactivated', category: { name: updated.name, active: updated.active } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to deactivate category' });
  }
};

/**
 * Activate an investment category for the family
 */
exports.activateCategory = async (req, res) => {
  try {
    const { category } = req.body;
    if (!category || String(category).trim() === "") {
      return res.status(400).json({ message: "category is required" });
    }
    const familyId = req.user.familyId;
    const name = category.toString().trim();

    const updated = await InvestmentCategory.findOneAndUpdate(
      { familyId, name },
      { $set: { active: true } },
      { upsert: true, new: true }
    );

    try {
      socketService.emitToFamily(familyId.toString(), 'investment:category:activated', { category: name });
    } catch (e) {}

    return res.json({ message: 'Category activated', category: { name: updated.name, active: updated.active } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Failed to activate category' });
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

    const actor = { id: req.user._id, name: req.user.name };

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "investment:duplicated",
      {
        investment,
        actor
      }
    );

    socketService.emitToFamily(
      req.user.familyId.toString(),
      "activity-created",
      {
        message: makeActivityMessage(req.user.name, "created", `${investment.investmentName} (duplicate)`, investment.amountInvested),
        meta: { type: "investment", investmentId: investment._id, duplicatedFrom: id },
        actor
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
