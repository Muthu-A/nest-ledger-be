const cron = require('node-cron');
const { copyPreviousMonthBudgets } = require('../services/budgetCarryForward.service');
const { generateRecurringBills } = require('../services/billCarryForward.service');
const { generateRecurringReminders } = require('../services/reminderCarryForward.service');

async function runAllOnce() {
  const start = Date.now();
  console.log('[CarryForwardJob] Manual run started');
  const result = { budgets: null, bills: null, reminders: null };
  try {
    result.budgets = await copyPreviousMonthBudgets();
    result.bills = await generateRecurringBills();
    result.reminders = await generateRecurringReminders();
  } catch (err) {
    console.error('[CarryForwardJob] runAllOnce error', err);
  }
  const durationMs = Date.now() - start;
  console.log('[CarryForwardJob] Manual run completed', { durationMs, result });
  return { durationMs, result };
}

function startDailyJob() {
  // Every day at 00:05
  cron.schedule('5 0 * * *', async () => {
    console.log('[CarryForwardJob] Cron tick - starting carry forward sequence');
    const startedAt = Date.now();
    try {
      await copyPreviousMonthBudgets();
      await generateRecurringBills();
      await generateRecurringReminders();
    } catch (err) {
      console.error('[CarryForwardJob] Cron error', err);
    }
    const durationMs = Date.now() - startedAt;
    console.log('[CarryForwardJob] Cron completed - durationMs=', durationMs);
  }, { timezone: process.env.TZ || 'UTC' });
}

module.exports = { startDailyJob, runAllOnce };
