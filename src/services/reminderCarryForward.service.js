const Reminder = require("../models/Reminder");
const Bill = require("../models/Bill");
const { getCurrentMonth, addDays, addWeeks, addMonths } = require("../utils/dateUtils");

function normalizeFrequency(freq) {
  if (!freq) return null;
  const f = String(freq).toLowerCase().replace(/[-_\s]/g, "");
  if (f.includes("day")) return "daily";
  if (f.includes("week")) return "weekly";
  if (f.includes("month")) return "monthly";
  if (f.includes("quarter")) return "quarterly";
  if (f.includes("half") && f.includes("year")) return "halfyearly";
  if (f.includes("year")) return "yearly";
  return f;
}

async function generateRecurringReminders() {
  const start = Date.now();
  console.log('[ReminderCarryForward] Started');
  const summary = { created: 0, skipped: 0 };
  try {
    // Strategy: For reminders that reference bills which are recurring, ensure a reminder exists for the next occurrence(s)
    const reminders = await Reminder.find().lean();
    for (const r of reminders) {
      // load bill to inspect frequency and dueDate
      const bill = await Bill.findById(r.billId).lean();
      if (!bill || !bill.isRecurring || !bill.frequency) continue;
      const freq = normalizeFrequency(bill.frequency);
      if (!freq) continue;

      // compute next due date from bill.dueDate
      let nextDue = new Date(bill.dueDate);
      const now = new Date();
      // advance until next due is in the future
      while (nextDue <= now) {
        if (freq === 'daily') nextDue = addDays(nextDue, 1);
        else if (freq === 'weekly') nextDue = addWeeks(nextDue, 1);
        else if (freq === 'monthly') nextDue = addMonths(nextDue, 1);
        else if (freq === 'quarterly') nextDue = addMonths(nextDue, 3);
        else if (freq === 'halfyearly') nextDue = addMonths(nextDue, 6);
        else if (freq === 'yearly') nextDue = addMonths(nextDue, 12);
        else break;
      }

      // Check if a bill instance exists for nextDue; if not, skip (bills service handles creating bills). However ensure a reminder exists for that bill if bill exists.
      const existingBill = await Bill.findOne({ familyId: bill.familyId, title: bill.title, dueDate: nextDue }).lean();
      if (!existingBill) {
        // nothing to attach to; skip
        summary.skipped += 1;
        continue;
      }

      // ensure reminder exists for new bill
      const exists = await Reminder.findOne({ billId: existingBill._id, daysBefore: r.daysBefore, reminderTime: r.reminderTime }).lean();
      if (exists) {
        summary.skipped += 1;
        continue;
      }

      await Reminder.create({
        billId: existingBill._id,
        familyId: r.familyId,
        reminderType: r.reminderType,
        daysBefore: r.daysBefore,
        reminderTime: r.reminderTime,
        pushEnabled: r.pushEnabled,
        emailEnabled: r.emailEnabled,
        smsEnabled: r.smsEnabled
      });
      summary.created += 1;
    }
  } catch (error) {
    console.error('[ReminderCarryForward] Error:', error);
  }
  const durationMs = Date.now() - start;
  console.log(`[ReminderCarryForward] Completed - created=${summary.created} skipped=${summary.skipped} durationMs=${durationMs}`);
  return { ...summary, durationMs };
}

module.exports = {
  generateRecurringReminders
};
