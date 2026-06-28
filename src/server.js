const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
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
const { getDashboardSummary, getRecentTransactions } = require("./controllers/dashboard.controller");

dotenv.config();

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
const socketRoutes = require("./routes/socket.routes");
const { startNotificationJobs } = require("./jobs/notificationJobs");
app.use("/api/socket", socketRoutes);
app.get("/api/summary", getDashboardSummary);
app.get("/api/recent", getRecentTransactions);

app.get("/", (req, res) => {
  res.send("Family Budget API Running");
});

startNotificationJobs();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const { initSocket } = require("./socket/socketServer");
initSocket(server, { corsOrigin: process.env.CLIENT_ORIGIN || "*" });

server.listen(PORT, () => {
  // Server started successfully
});
