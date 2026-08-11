const Bill = require("../models/Bill");
const Reminder = require("../models/Reminder");
const { getCurrentMonth, startOfMonth, endOfMonth, addMonths, addWeeks, addDays } = require("../utils/dateUtils");

function normalizeFrequency(freq) {
  if (!freq) return null;
  const f = String(freq).toLowerCase().replace(/[-_\s]/g, "");
  if (f.includes("month")) return "monthly";
  if (f.includes("week")) return "weekly";
  if (f.includes("quarter")) return "quarterly";
  if (f.includes("half") && f.includes("year")) return "halfyearly";
  if (f.includes("year")) return "yearly";
  return f;
}

async function generateRecurringBills() {
  const start = Date.now();
  console.log("[BillCarryForward] Started");
  const summary = { created: 0, skipped: 0 };
  try {
    const currentMonth = getCurrentMonth();
    const targetStart = startOfMonth(currentMonth);
    const targetEnd = endOfMonth(currentMonth);

    // Find all recurring bills
    const recurringBills = await Bill.find({ isRecurring: true }).lean();
    for (const bill of recurringBills) {
      const freq = normalizeFrequency(bill.frequency);
      if (!freq) continue;

      let candidate = new Date(bill.dueDate);

      // Move candidate forward until it reaches targetStart or beyond
      while (candidate < targetStart) {
        if (freq === "weekly") candidate = addWeeks(candidate, 1);
        else if (freq === "monthly") candidate = addMonths(candidate, 1);
        else if (freq === "quarterly") candidate = addMonths(candidate, 3);
        else if (freq === "halfyearly") candidate = addMonths(candidate, 6);
        else if (freq === "yearly") candidate = addMonths(candidate, 12);
        else break;
      }

      // For weekly, there could be multiple occurrences in target month
      while (candidate >= targetStart && candidate <= targetEnd) {
        // Only create future bills (due date >= now)
        const now = new Date();
        if (candidate >= now) {
          // prevent duplicates
          const exists = await Bill.findOne({ familyId: bill.familyId, title: bill.title, dueDate: candidate }).lean();
          if (exists) {
            summary.skipped += 1;
          } else {
            // Create a clean new bill instance for the cloned due date.
            // Do NOT carry over any previous-month payment or status details.
            const payload = {
              familyId: bill.familyId,
              createdBy: bill.createdBy,
              title: bill.title,
              category: bill.category,
              amount: bill.amount,
              dueDate: candidate,
              isRecurring: true,
              frequency: bill.frequency,
              autoPay: bill.autoPay || false,
              status: 'upcoming',
              notes: bill.notes
            };
            const created = await Bill.create(payload);
            summary.created += 1;

            // Carry forward reminders linked to original bill
            try {
              const reminders = await Reminder.find({ billId: bill._id }).lean();
              for (const r of reminders) {
                // avoid duplicate reminders for the new bill
                const already = await Reminder.findOne({ billId: created._id, daysBefore: r.daysBefore, reminderTime: r.reminderTime }).lean();
                if (already) continue;
                await Reminder.create({
                  billId: created._id,
                  familyId: r.familyId,
                  reminderType: r.reminderType,
                  daysBefore: r.daysBefore,
                  reminderTime: r.reminderTime,
                  pushEnabled: r.pushEnabled,
                  emailEnabled: r.emailEnabled,
                  smsEnabled: r.smsEnabled
                });
              }
            } catch (remErr) {
              console.error('[BillCarryForward] reminder copy error', remErr);
            }
          }
        } else {
          summary.skipped += 1;
        }

        // advance by frequency
        if (freq === "weekly") candidate = addWeeks(candidate, 1);
        else if (freq === "monthly") candidate = addMonths(candidate, 1);
        else if (freq === "quarterly") candidate = addMonths(candidate, 3);
        else if (freq === "halfyearly") candidate = addMonths(candidate, 6);
        else if (freq === "yearly") candidate = addMonths(candidate, 12);
        else break;
      }
    }
  } catch (error) {
    console.error("[BillCarryForward] Error:", error);
  }
  const durationMs = Date.now() - start;
  console.log(`[BillCarryForward] Completed - created=${summary.created} skipped=${summary.skipped} durationMs=${durationMs}`);
  return { ...summary, durationMs };
}

module.exports = {
  generateRecurringBills
};
