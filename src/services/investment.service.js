const Investment = require("../models/Investment");
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

  _computeNextReminderDate(investment) {
    if (!investment.reminderEnabled || !investment.reminderDate) {
      return null;
    }

    const frequency = investment.frequency;
    const baseDate = this._normalizeDate(investment.reminderDate);
    if (Number.isNaN(baseDate.getTime())) {
      return null;
    }

    const today = this._normalizeDate(new Date());
    let nextDate = new Date(baseDate);

    if (frequency === "OneTime") {
      return nextDate >= today ? nextDate : null;
    }

    const dayOfMonth = baseDate.getDate();
    const frequencyMonths = {
      Monthly: 1,
      Quarterly: 3,
      HalfYearly: 6,
      Yearly: 12
    };

    const step = frequencyMonths[frequency] || 0;
    if (step <= 0) {
      return null;
    }

    // If the base reminder date itself is today or in the future, use it.
    if (nextDate >= today) {
      return nextDate;
    }

    let iterationDate = new Date(baseDate);
    while (iterationDate < today) {
      if (frequency === "Yearly") {
        iterationDate = this._addMonthsWithDay(iterationDate, 12, dayOfMonth);
      } else {
        iterationDate = this._addMonthsWithDay(iterationDate, step, dayOfMonth);
      }
    }

    return iterationDate;
  }

  /**
   * Get all investments with pagination, search, sorting, filtering
   */
  async getInvestments(familyId, query = {}) {
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

      const [investments, total] = await Promise.all([
        Investment.find(match)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate("userId", "name email")
          .lean(),
        Investment.countDocuments(match)
      ]);

      // Attach computed nextReminderDate for recurring reminders
      const investmentsWithNextReminder = investments.map((inv) => {
        try {
          const next = this._computeNextReminderDate(inv);
          return { ...inv, nextReminderDate: next ? next.toISOString() : null };
        } catch (err) {
          return { ...inv, nextReminderDate: null };
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
      throw new Error(`Failed to fetch investments: ${error.message}`);
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
      const allocationArray = Object.entries(allocation).map(([category, amount]) => ({
        category,
        amount,
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
        status: "ACTIVE",
        isDeleted: false
      }).populate("userId", "name email");

      return investments.filter((inv) => {
        const nextReminderDate = this._computeNextReminderDate(inv);
        return nextReminderDate && nextReminderDate.getTime() === today.getTime();
      });
    } catch (error) {
      throw new Error(`Failed to fetch reminder investments: ${error.message}`);
    }
  }
}

module.exports = new InvestmentService();
