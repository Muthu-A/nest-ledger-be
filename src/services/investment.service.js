const dayjs = require("dayjs");
const Investment = require("../models/Investment");
const InvestmentCategory = require("../models/InvestmentCategory");
const mongoose = require("mongoose");

class InvestmentService {
  /**
   * Create a new investment
   */
  async createInvestment(payload) {
    try {
      const investment = new Investment(payload);
      await investment.save();
      return investment.populate(["familyId", "userId"]);
    } catch (error) {
      throw new Error(`Failed to create investment: ${error.message}`);
    }
  }

  _normalizeDate(date) {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    normalized.setMinutes(0, 0, 0, 0);
    normalized.setSeconds(0, 0, 0, 0);
    normalized.setMilliseconds(0);
    return normalized;
  }

  _getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  _addMonthsWithDay(date, months, day) {
    const newDate = new Date(date);
    const targetMonth = newDate.getMonth() + months;
    const year = newDate.getFullYear();
    const month = targetMonth;
    const lastDay = this._getLastDayOfMonth(year, month);
    newDate.setFullYear(year);
    newDate.setMonth(month);
    newDate.setDate(Math.min(day, lastDay));
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  }

  _getNextReminderDate(baseReminderDate, frequency) {
    if (!baseReminderDate) return null;
    const base = dayjs(baseReminderDate).startOf("day");
    if (!base.isValid()) return null;

    switch (frequency) {
      case "Daily":
        return base.add(1, "day");
      case "Weekly":
        return base.add(1, "week");
      case "Monthly":
        return base.add(1, "month");
      case "Quarterly":
        return base.add(3, "month");
      case "HalfYearly":
        return base.add(6, "month");
      case "Yearly":
        return base.add(1, "year");
      default:
        return null;
    }
  }

  _computeNextReminderDate(investment) {
    if (!investment.reminderEnabled || !investment.reminderDate) {
      return null;
    }

    const baseDate = dayjs(investment.reminderDate).startOf("day");
    if (!baseDate.isValid()) {
      return null;
    }

    const today = dayjs().startOf("day");

    if (investment.frequency === "OneTime") {
      return baseDate.isSame(today) || baseDate.isAfter(today) ? baseDate.toDate() : null;
    }

    if (baseDate.isSame(today) || baseDate.isAfter(today)) {
      return baseDate.toDate();
    }

    const next = this._computeNextFutureReminderDate(investment);
    return next ? next.toDate() : null;
  }

  async getCategoryStateMap(familyId) {
    const categories = await InvestmentCategory.find({ familyId }).lean();
    const map = new Map();
    categories.forEach((category) => {
      map.set(category.name, category.active);
    });
    return map;
  }

  _computeNextFutureReminderDate(investment) {
    if (!investment.reminderDate) return null;
    if (investment.frequency === "OneTime") return null;

    const baseDate = dayjs(investment.reminderDate).startOf("day");
    if (!baseDate.isValid()) return null;

    const today = dayjs().startOf("day");
    let next = baseDate;

    const frequencyUnits = {
      Daily: { amount: 1, unit: "day" },
      Weekly: { amount: 1, unit: "week" },
      Monthly: { amount: 1, unit: "month" },
      Quarterly: { amount: 3, unit: "month" },
      HalfYearly: { amount: 6, unit: "month" },
      Yearly: { amount: 1, unit: "year" }
    };

    const rule = frequencyUnits[investment.frequency];
    if (!rule) return null;

    while (!next.isAfter(today)) {
      next = next.add(rule.amount, rule.unit);
    }

    return next;
  }

  _isReminderDue(investment) {
    if (!investment.reminderEnabled || !investment.reminderDate) {
      return false;
    }
    const reminderDate = dayjs(investment.reminderDate).startOf("day");
    const today = dayjs().startOf("day");
    return !reminderDate.isAfter(today);
  }

  async advanceInvestmentReminder(investment) {
    if (!investment || !investment.reminderEnabled || !investment.reminderDate) {
      return null;
    }

    const reminderDate = dayjs(investment.reminderDate).startOf("day");
    const today = dayjs().startOf("day");
    if (reminderDate.isAfter(today)) {
      return null;
    }

    if (investment.frequency === "OneTime") {
      await Investment.updateOne({ _id: investment._id }, { reminderDate: null });
      return null;
    }

    const nextReminder = this._computeNextFutureReminderDate(investment);
    if (!nextReminder) {
      return null;
    }

    await Investment.updateOne({ _id: investment._id }, { reminderDate: nextReminder.toDate() });
    return nextReminder.toDate();
  }

  /**
   * Get all investments with pagination, search, sorting, filtering
   */
  async getInvestments(familyId, query = {}, raw = false) {
    try {

      const {
        page = 1,
        limit = 10,
        search,
        category,
        status,
        frequency,
        sortBy = "createdAt",
        order = "desc"
      } = query;

      const skip = (page - 1) * limit;
      const match = {
        familyId: new mongoose.Types.ObjectId(familyId),
        isDeleted: false
      };

      // Search filter
      if (search) {
        match.$or = [
          { investmentName: { $regex: search, $options: "i" } },
          { notes: { $regex: search, $options: "i" } },
          { platform: { $regex: search, $options: "i" } }
        ];
      }

      // Category filter
      if (category) {
        match.category = category;
      }

      // Status filter
      if (status) {
        match.status = status;
      }

      // Frequency filter
      if (frequency) {
        match.frequency = frequency;
      }

      const sortObj = {};
      sortObj[sortBy] = order === "desc" ? -1 : 1;

      const investments = await Investment.find(match)
        .sort(sortObj)
        .populate("userId", "name email")
        .lean();

      const investmentsWithNextReminder = investments.map((inv) => {
        try {
          const next = this._computeNextReminderDate(inv);
          return { ...inv, nextReminderDate: next ? next.toISOString() : null };
        } catch (err) {
          return { ...inv, nextReminderDate: null };
        }
      });

      if (raw) {
        const total = investmentsWithNextReminder.length;
        return {
          investments: investmentsWithNextReminder.slice(skip, skip + limit),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        };
      }

      const categoryMap = new Map();
      investmentsWithNextReminder.forEach((inv) => {
        const categoryKey = inv.category || "Others";
        let group = categoryMap.get(categoryKey);
        if (!group) {
          group = {
            _id: null,
            familyId: inv.familyId,
            userId: inv.userId,
            investmentName: categoryKey,
            category: categoryKey,
            amountInvested: 0,
            currentValue: 0,
            platform: null,
            frequency: null,
            purchaseDate: null,
            reminderEnabled: false,
            reminderDate: null,
            notes: null,
            status: "ACTIVE",
            isDeleted: false,
            createdAt: null,
            updatedAt: null,
            nextReminderDate: null,
            latestTransactionDate: null,
            latestTransactionId: null
          };
          categoryMap.set(categoryKey, group);
        }

        group.amountInvested += inv.amountInvested || 0;
        group.currentValue += inv.currentValue || 0;
        if (!group.platform && inv.platform) group.platform = inv.platform;
        if (!group.notes && inv.notes) group.notes = inv.notes;

        const invPurchaseDate = inv.purchaseDate ? new Date(inv.purchaseDate) : null;
        const currentPurchaseDate = group.latestTransactionDate ? new Date(group.latestTransactionDate) : null;
        const invCreatedAt = inv.createdAt ? new Date(inv.createdAt) : null;
        const currentCreatedAt = group.createdAt ? new Date(group.createdAt) : null;

        const isLaterPurchase = !currentPurchaseDate || (invPurchaseDate && invPurchaseDate > currentPurchaseDate);
        const isSamePurchaseButLaterCreate = currentPurchaseDate && invPurchaseDate && invPurchaseDate.getTime() === currentPurchaseDate.getTime() && invCreatedAt && (!currentCreatedAt || invCreatedAt > currentCreatedAt);

        if (isLaterPurchase || isSamePurchaseButLaterCreate) {
          group._id = inv._id;
          group.purchaseDate = inv.purchaseDate;
          group.reminderEnabled = Boolean(inv.reminderEnabled);
          group.reminderDate = inv.reminderEnabled && inv.reminderDate ? inv.reminderDate : null;
          group.nextReminderDate = inv.nextReminderDate || null;
          group.frequency = inv.frequency || group.frequency;
          group.platform = inv.platform || group.platform;
          group.notes = inv.notes || group.notes;
          group.userId = inv.userId;
          group.latestTransactionId = inv._id;
          group.latestTransactionDate = inv.purchaseDate || inv.createdAt;
        }

        if (!group.createdAt || (inv.createdAt && new Date(inv.createdAt) > new Date(group.createdAt))) {
          group.createdAt = inv.createdAt;
        }
        if (!group.updatedAt || (inv.updatedAt && new Date(inv.updatedAt) > new Date(group.updatedAt))) {
          group.updatedAt = inv.updatedAt;
        }

        if (!group.frequency) {
          group.frequency = inv.frequency;
        } else if (group.frequency !== inv.frequency && group.frequency !== "Mixed") {
          group.frequency = "Mixed";
        }
      });

      const activeMap = await this.getCategoryStateMap(familyId);
      const groupedInvestments = Array.from(categoryMap.values()).map((group) => {
        const { latestTransactionDate, latestTransactionId, ...rest } = group;
        const active = activeMap.has(rest.category) ? activeMap.get(rest.category) : true;
        return {
          ...rest,
          active,
          status: active ? rest.status : "INACTIVE"
        };
      });

      const total = groupedInvestments.length;
      const pagedInvestments = groupedInvestments.slice(skip, skip + limit);

      return {
        investments: pagedInvestments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch investments: ${error.message}`);
    }
  }

  async getInvestmentHistory(familyId, category, query = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        frequency,
        status,
        sortBy = "purchaseDate",
        order = "desc"
      } = query;

      const skip = (page - 1) * limit;
      const match = {
        familyId: new mongoose.Types.ObjectId(familyId),
        isDeleted: false
      };

      if (category) {
        match.category = category;
      }
      if (search) {
        match.$or = [
          { investmentName: { $regex: search, $options: "i" } },
          { notes: { $regex: search, $options: "i" } },
          { platform: { $regex: search, $options: "i" } }
        ];
      }
      if (frequency) {
        match.frequency = frequency;
      }
      if (status) {
        match.status = status;
      }

      const sortObj = {};
      sortObj[sortBy] = order === "desc" ? -1 : 1;

      const [investments, total] = await Promise.all([
        Investment.find(match)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate("userId", "name email")
          .lean(),
        Investment.countDocuments(match)
      ]);

      const categoryActiveMap = await this.getCategoryStateMap(familyId);
      const investmentsWithNextReminder = investments.map((inv) => {
        try {
          const next = this._computeNextReminderDate(inv);
          return {
            ...inv,
            nextReminderDate: next ? next.toISOString() : null,
            categoryActive: categoryActiveMap.has(inv.category) ? categoryActiveMap.get(inv.category) : true
          };
        } catch (err) {
          return {
            ...inv,
            nextReminderDate: null,
            categoryActive: categoryActiveMap.has(inv.category) ? categoryActiveMap.get(inv.category) : true
          };
        }
      });

      return {
        investments: investmentsWithNextReminder,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch investment history: ${error.message}`);
    }
  }

  async getInvestmentHistoryById(id, familyId, query = {}) {
    try {
      const investment = await this.getInvestmentById(id, familyId);
      return this.getInvestmentHistory(familyId, investment.category, query);
    } catch (error) {
      throw new Error(`Failed to fetch investment history by id: ${error.message}`);
    }
  }

  /**
   * Get single investment by ID
   */
  async getInvestmentById(id, familyId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid investment ID");
      }

      const investment = await Investment.findOne({
        _id: id,
        familyId,
        isDeleted: false
      }).populate(["familyId", "userId"]);

      if (!investment) {
        throw new Error("Investment not found");
      }

      return investment;
    } catch (error) {
      throw new Error(`Failed to fetch investment: ${error.message}`);
    }
  }

  /**
   * Update investment
   */
  async updateInvestment(id, familyId, userId, updates) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid investment ID");
      }

      const investment = await Investment.findOne({
        _id: id,
        familyId,
        isDeleted: false
      });

      if (!investment) {
        throw new Error("Investment not found");
      }

      // Only creator or owner can edit
      if (investment.userId.toString() !== userId.toString()) {
        throw new Error("Unauthorized to edit this investment");
      }

      Object.assign(investment, updates);
      await investment.save();
      return investment.populate(["familyId", "userId"]);
    } catch (error) {
      throw new Error(`Failed to update investment: ${error.message}`);
    }
  }

  /**
   * Soft delete investment
   */
  async deleteInvestment(id, familyId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid investment ID");
      }

      const investment = await Investment.findOne({
        _id: id,
        familyId,
        isDeleted: false
      });

      if (!investment) {
        throw new Error("Investment not found");
      }

      // Only creator or owner can delete
      if (investment.userId.toString() !== userId.toString()) {
        throw new Error("Unauthorized to delete this investment");
      }

      investment.isDeleted = true;
      await investment.save();
      return { message: "Investment deleted successfully" };
    } catch (error) {
      throw new Error(`Failed to delete investment: ${error.message}`);
    }
  }

  /**
   * Calculate dashboard metrics
   */
  async getDashboardMetrics(familyId) {
    try {
      const investments = await Investment.find({
        familyId,
        status: "ACTIVE",
        isDeleted: false
      }).lean();

      const totalInvested = investments.reduce((sum, inv) => sum + inv.amountInvested, 0);
      const currentPortfolioValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
      const gain = currentPortfolioValue - totalInvested;
      const gainPercentage = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

      // Calculate monthly investments
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const previousMonth = new Date(currentMonth);
      previousMonth.setMonth(previousMonth.getMonth() - 1);

      const thisMonthInvestments = investments.filter((inv) => new Date(inv.purchaseDate) >= currentMonth);
      const monthlyInvested = thisMonthInvestments.reduce((sum, inv) => sum + inv.amountInvested, 0);
      const thisMonthCurrentValue = thisMonthInvestments.reduce((sum, inv) => sum + inv.currentValue, 0);
      const thisMonthGain = thisMonthCurrentValue - monthlyInvested;
      const thisMonthGainPercentage = monthlyInvested > 0 ? (thisMonthGain / monthlyInvested) * 100 : 0;

      const previousMonthInvested = investments
        .filter((inv) => {
          const purchase = new Date(inv.purchaseDate);
          return purchase >= previousMonth && purchase < currentMonth;
        })
        .reduce((sum, inv) => sum + inv.amountInvested, 0);

      const monthlyComparisonPercentage = previousMonthInvested > 0
        ? ((monthlyInvested - previousMonthInvested) / previousMonthInvested) * 100
        : monthlyInvested > 0
          ? 100
          : 0;

      return {
        totalInvested,
        currentPortfolioValue,
        gain,
        gainPercentage: parseFloat(gainPercentage.toFixed(2)),
        monthlyInvested,
        thisMonthCurrentValue,
        thisMonthGain,
        thisMonthGainPercentage: parseFloat(thisMonthGainPercentage.toFixed(2)),
        previousMonthInvested,
        monthlyComparisonPercentage: parseFloat(monthlyComparisonPercentage.toFixed(2)),
        totalInvestments: investments.length
      };
    } catch (error) {
      throw new Error(`Failed to calculate dashboard metrics: ${error.message}`);
    }
  }

  /**
   * Get allocation by category
   */
  async getAllocation(familyId) {
    try {
      const investments = await Investment.find({
        familyId,
        status: "ACTIVE",
        isDeleted: false
      }).lean();

      const allocation = {};
      investments.forEach((inv) => {
        if (!allocation[inv.category]) {
          allocation[inv.category] = 0;
        }
        allocation[inv.category] += inv.currentValue;
      });

      const totalValue = Object.values(allocation).reduce((sum, val) => sum + val, 0);
      const categoryActiveMap = await this.getCategoryStateMap(familyId);
      const allocationArray = Object.entries(allocation).map(([category, amount]) => ({
        category,
        amount,
        active: categoryActiveMap.has(category) ? categoryActiveMap.get(category) : true,
        percentage: totalValue > 0 ? parseFloat(((amount / totalValue) * 100).toFixed(2)) : 0
      }));

      return allocationArray.sort((a, b) => b.amount - a.amount);
    } catch (error) {
      throw new Error(`Failed to calculate allocation: ${error.message}`);
    }
  }

  /**
   * Get monthly trend
   */
  async getMonthlyTrend(familyId, months = 12) {
    try {
      const investments = await Investment.find({
        familyId,
        isDeleted: false
      }).lean();

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthData = {};
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      // Initialize all 12 months of current year
      for (let i = 0; i < 12; i++) {
        const monthName = monthNames[i];
        monthData[monthName] = 0;
      }

      // Aggregate investments by month (only current year)
      investments.forEach((inv) => {
        const purchaseDate = new Date(inv.purchaseDate);
        if (purchaseDate.getFullYear() === currentYear) {
          const monthName = monthNames[purchaseDate.getMonth()];
          monthData[monthName] += inv.amountInvested;
        }
      });

      // Return in month order
      const trend = monthNames.map((month) => ({
        month,
        amount: monthData[month]
      }));

      return trend;
    } catch (error) {
      throw new Error(`Failed to calculate monthly trend: ${error.message}`);
    }
  }

  /**
   * Get recent investments
   */
  async getRecentInvestments(familyId, limit = 10) {
    try {
      const investments = await Investment.find({
        familyId,
        isDeleted: false
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("userId", "name email")
        .lean();

      return investments;
    } catch (error) {
      throw new Error(`Failed to fetch recent investments: ${error.message}`);
    }
  }

  /**
   * Get upcoming reminders
   */
  async getUpcomingReminders(familyId) {
    try {
      const today = this._normalizeDate(new Date());

      const investments = await Investment.find({
        familyId,
        reminderEnabled: true,
        status: "ACTIVE",
        isDeleted: false
      })
        .populate("userId", "name email")
        .lean();

      const upcoming = investments
        .map((inv) => {
          const nextReminderDate = this._computeNextReminderDate(inv);
          return nextReminderDate
            ? {
                _id: inv._id,
                investmentName: inv.investmentName,
                reminderDate: nextReminderDate,
                frequency: inv.frequency,
                amountInvested: inv.amountInvested,
                currentValue: inv.currentValue
              }
            : null;
        })
        .filter(Boolean)
        .filter((item) => item.reminderDate >= today)
        .sort((a, b) => new Date(a.reminderDate) - new Date(b.reminderDate));

      return upcoming;
    } catch (error) {
      throw new Error(`Failed to fetch upcoming reminders: ${error.message}`);
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(familyId) {
    try {
      const investments = await Investment.find({
        familyId,
        isDeleted: false
      }).lean();

      // Category counts
      const categoryCounts = {};
      const platformCounts = {};
      const frequencyCounts = {};
      let gainCount = 0;
      let lossCount = 0;

      investments.forEach((inv) => {
        // Category counts
        categoryCounts[inv.category] = (categoryCounts[inv.category] || 0) + 1;

        // Platform counts
        if (inv.platform) {
          platformCounts[inv.platform] = (platformCounts[inv.platform] || 0) + 1;
        }

        // Frequency counts
        frequencyCounts[inv.frequency] = (frequencyCounts[inv.frequency] || 0) + 1;

        // Gain/Loss summary
        const gain = inv.currentValue - inv.amountInvested;
        if (gain > 0) {
          gainCount++;
        } else if (gain < 0) {
          lossCount++;
        }
      });

      return {
        categoryCounts,
        platformCounts,
        frequencyCounts,
        gainLossSummary: {
          gainCount,
          lossCount,
          noChangeCount: investments.length - gainCount - lossCount
        }
      };
    } catch (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }
  }

  /**
   * Duplicate investment
   */
  async duplicateInvestment(id, familyId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid investment ID");
      }

      const investment = await Investment.findOne({
        _id: id,
        familyId,
        isDeleted: false
      });

      if (!investment) {
        throw new Error("Investment not found");
      }

      const duplicate = new Investment({
        ...investment.toObject(),
        _id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        investmentName: `${investment.investmentName} (Copy)`,
        userId: new mongoose.Types.ObjectId(userId)
      });

      await duplicate.save();
      return duplicate.populate(["familyId", "userId"]);
    } catch (error) {
      throw new Error(`Failed to duplicate investment: ${error.message}`);
    }
  }

  /**
   * Get investments that need reminder today
   */
  async getInvestmentsNeedingReminderToday() {
    try {
      const today = this._normalizeDate(new Date());

      const investments = await Investment.find({
        reminderEnabled: true,
        reminderDate: { $lte: today },
        status: "ACTIVE",
        isDeleted: false
      }).populate("userId", "name email");

      return investments;
    } catch (error) {
      throw new Error(`Failed to fetch reminder investments: ${error.message}`);
    }
  }
}

module.exports = new InvestmentService();
