const Budget = require("../models/Budget");
const { getCurrentMonth, getPreviousMonth } = require("../utils/dateUtils");

async function copyPreviousMonthBudgets() {
  const start = Date.now();
  console.log("[BudgetCarryForward] Started");
  const summary = { created: 0, skipped: 0 };
  try {
    const currentMonth = getCurrentMonth();
    const previousMonth = getPreviousMonth();

    // If any budget exists for current month, skip families that already have budgets
    const prevBudgets = await Budget.find({ month: previousMonth }).lean();
    if (!prevBudgets || prevBudgets.length === 0) {
      console.log("[BudgetCarryForward] No budgets found for previous month");
      return { ...summary, durationMs: Date.now() - start };
    }

    // Group by familyId (null/undefined treated as 'personal')
    const buckets = {};
    prevBudgets.forEach((b) => {
      const key = b.familyId ? String(b.familyId) : "__personal";
      buckets[key] = buckets[key] || [];
      buckets[key].push(b);
    });

    for (const key of Object.keys(buckets)) {
      const familyId = key === "__personal" ? null : buckets[key][0].familyId;
      const exists = await Budget.findOne({ month: currentMonth, familyId }).lean();
      if (exists) {
        summary.skipped += buckets[key].length;
        continue;
      }

      // Prepare new budgets
      const toInsert = [];
      for (const prev of buckets[key]) {
        // Ensure uniqueness per userId/month/category
        const already = await Budget.findOne({ month: currentMonth, familyId: prev.familyId, category: prev.category }).lean();
        if (already) {
          summary.skipped += 1;
          continue;
        }
        const doc = {
          month: currentMonth,
          category: prev.category,
          budgetAmount: prev.budgetAmount,
          familyId: prev.familyId || undefined,
          createdBy: prev.createdBy || undefined
        };
        toInsert.push(doc);
      }

      if (toInsert.length > 0) {
        const inserted = await Budget.insertMany(toInsert);
        summary.created += inserted.length;
      }
    }
  } catch (error) {
    console.error("[BudgetCarryForward] Error:", error);
  }
  const durationMs = Date.now() - start;
  console.log(`[BudgetCarryForward] Completed - created=${summary.created} skipped=${summary.skipped} durationMs=${durationMs}`);
  return { ...summary, durationMs };
}

module.exports = {
  copyPreviousMonthBudgets
};
