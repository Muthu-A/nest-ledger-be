const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const incomeRoutes = require("./routes/income.routes");
const expenseRoutes = require("./routes/expense.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const reportRoutes = require("./routes/report.routes");
const categoryRoutes = require("./routes/category.routes");
const goalRoutes = require("./routes/goal.routes");
const financialRoutes = require("./routes/financial.routes");
const budgetRoutes = require("./routes/budget.routes");
const familyRoutes = require("./routes/family.routes");
const notificationRoutes = require("./routes/notification.routes");
const billRoutes = require("./routes/bill.routes");
const reminderRoutes = require("./routes/reminder.routes");
const investmentRoutes = require("./routes/investment.routes");
const systemRoutes = require("./routes/system.routes");
const aiInsightsRoutes = require("./aiInsights/routes/aiInsights.routes");
const financialInsightsRoutes = require("./aiInsights/routes/financialInsights.routes");
const bugReportRoutes = require("./routes/bugReport.routes");
const loanRoutes = require("./routes/loan.routes");
const userRoutes = require("./routes/user.routes");
const { getDashboardSummary, getRecentTransactions } = require("./controllers/dashboard.controller");

const http = require("http");
const app = express();

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

const monthMiddleware = require("./middlewares/month.middleware");
app.use(monthMiddleware);

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/income", incomeRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/financial", financialRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/investments", investmentRoutes);
app.use("/api/bug-reports", bugReportRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/users", userRoutes);
app.use("/api/system/carry-forward", systemRoutes);
app.use("/api/ai-insights", aiInsightsRoutes);
app.use("/api/financial-insights", financialInsightsRoutes);
app.use("/ai", aiInsightsRoutes);
app.use("/ai/financial-insights", financialInsightsRoutes);
const socketRoutes = require("./routes/socket.routes");
const { startNotificationJobs } = require("./jobs/notificationJobs");
const { startInvestmentJobs } = require("./jobs/investmentJobs");
app.use("/api/socket", socketRoutes);
app.get("/api/summary", getDashboardSummary);
app.get("/api/recent", getRecentTransactions);

app.get("/", (req, res) => {
  res.send("Family Budget API Running");
});

startNotificationJobs();
startInvestmentJobs();
const { startDailyJob } = require("./jobs/carryForwardJob");
startDailyJob();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const { initSocket } = require("./socket/socketServer");
initSocket(server, { corsOrigin: process.env.CLIENT_ORIGIN || "*" });

server.listen(PORT, () => {
  // Server started successfully
});
