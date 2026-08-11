const { copyPreviousMonthBudgets } = require('../services/budgetCarryForward.service');
const { generateRecurringBills } = require('../services/billCarryForward.service');
const { generateRecurringReminders } = require('../services/reminderCarryForward.service');

async function triggerBudgets(req, res) {
  try {
    const summary = await copyPreviousMonthBudgets();
    res.json({ success: true, ...summary });
  } catch (error) {
    console.error('triggerBudgets error', error);
    res.status(500).json({ success: false, message: 'Failed to copy budgets' });
  }
}

async function triggerBills(req, res) {
  try {
    const summary = await generateRecurringBills();
    res.json({ success: true, ...summary });
  } catch (error) {
    console.error('triggerBills error', error);
    res.status(500).json({ success: false, message: 'Failed to generate bills' });
  }
}

async function triggerReminders(req, res) {
  try {
    const summary = await generateRecurringReminders();
    res.json({ success: true, ...summary });
  } catch (error) {
    console.error('triggerReminders error', error);
    res.status(500).json({ success: false, message: 'Failed to generate reminders' });
  }
}

module.exports = { triggerBudgets, triggerBills, triggerReminders };
