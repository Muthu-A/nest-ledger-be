const cron = require("node-cron");
const investmentService = require("../services/investment.service");
const NotificationToken = require("../models/NotificationToken");
const { sendNotification } = require("../services/notification.service");
const socketService = require("../services/socketService");

/**
 * Send investment reminders for investments due today
 */
const sendInvestmentReminders = async () => {
  try {
    const investments = await investmentService.getInvestmentsNeedingReminderToday();

    for (const investment of investments) {
      try {
        // Get user notification tokens
        const tokens = await NotificationToken.find({
          userId: investment.userId._id
        }).distinct("token");

        const title = "Investment Reminder";
        const body = `Reminder: ${investment.investmentName} - ${investment.frequency} investment due today. Amount: ₹${investment.amountInvested}`;

        if (tokens.length > 0) {
          await sendNotification(tokens, title, body, {
            investmentId: investment._id.toString(),
            type: "investment_reminder"
          });

          // Emit socket event
          socketService.emitToFamily(
            investment.familyId.toString(),
            "investment:reminder",
            {
              investment: {
                _id: investment._id,
                investmentName: investment.investmentName,
                amountInvested: investment.amountInvested,
                frequency: investment.frequency
              },
              message: `Reminder: ${investment.investmentName} investment due today`
            }
          );

          console.log(`Investment reminder sent for: ${investment.investmentName}`);
        } else {
          console.log(`No notification tokens for investment ${investment._id}. Advancing reminder date without sending push.`);
        }

        const nextReminderDate = await investmentService.advanceInvestmentReminder(investment);
        console.log(`Advanced reminder for ${investment._id} to ${nextReminderDate || "none"}`);
      } catch (error) {
        console.error(`Failed to send reminder for investment ${investment._id}:`, error);
      }
    }
  } catch (error) {
    console.error("Failed to send investment reminders:", error);
  }
};

/**
 * Start all investment scheduled jobs
 */
const startInvestmentJobs = () => {
  // Run investment reminders every day at 8:00 AM
  cron.schedule("0 8 * * *", () => {
    console.log("Running daily investment reminder job...");
    sendInvestmentReminders();
  });

  console.log("Investment scheduled jobs started");
};

module.exports = {
  sendInvestmentReminders,
  startInvestmentJobs
};
