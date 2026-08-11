const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const Reminder = require("../models/Reminder");
const socketService = require("../services/socketService");
const { generateRecurringBills } = require("../services/billCarryForward.service");
const { getCurrentMonth } = require("../utils/dateUtils");

const getBillStatus = (dueDate) => {
  const now = new Date();
  const dueDateObj = new Date(dueDate);
  // Compare using UTC end-of-day to match stored UTC due dates
  dueDateObj.setUTCHours(23, 59, 59, 999);
  if (dueDateObj < now) return "overdue";
  return "upcoming";
};

const addFrequency = (date, frequency) => {
  if (!date || !frequency) return new Date(date);
  const next = new Date(date);
  switch (frequency.toLowerCase()) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
};

const requireFamilyContext = (req, res) => {
  if (!req.user || !req.user.familyId) {
    res.status(403).json({ success: false, message: "Family context required" });
    return false;
  }
  return true;
};

const requireWriteAccess = (req, res) => {
  if (req.user?.role === "viewer") {
    res.status(403).json({ success: false, message: "Insufficient role" });
    return false;
  }
  return true;
};

const attachPaidDateToBills = async (bills) => {
  if (!Array.isArray(bills) || bills.length === 0) return bills;
  const paidBillIds = bills.filter((bill) => bill.status === "paid").map((bill) => bill._id);
  if (paidBillIds.length === 0) return bills;
  const payments = await Payment.find({ billId: { $in: paidBillIds } })
    .sort({ billId: 1, paidDate: -1 })
    .lean();
  const latestPaymentByBillId = payments.reduce((acc, payment) => {
    const key = payment.billId.toString();
    if (!acc[key]) acc[key] = payment;
    return acc;
  }, {});
  return bills.map((bill) => {
    const payment = latestPaymentByBillId[bill._id.toString()];
    return {
      ...bill,
      paidDate: payment?.paidDate
    };
  });
};

const getBillById = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    const { id } = req.params;
    const bill = await Bill.findOne({ _id: id, familyId: req.user.familyId }).populate("createdBy", "name email").lean();
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    // Compute dynamic status
    const computedStatus = bill.status === "paid" ? "paid" : getBillStatus(bill.dueDate);
    let paidDate;
    if (computedStatus === "paid") {
      const payment = await Payment.findOne({ billId: bill._id }).sort({ paidDate: -1 }).lean();
      paidDate = payment?.paidDate;
    }
    res.json({ success: true, data: { ...bill, status: computedStatus, paidDate } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch bill" });
  }
};

const getBills = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    const { status, startDate, endDate } = req.query;
    const filter = { familyId: req.user.familyId };
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isDefaultList = !status && !startDate && !endDate;

    // Don't filter by status in DB query - we'll compute it dynamically
    if (startDate || endDate) {
      filter.dueDate = {};
      if (startDate) filter.dueDate.$gte = new Date(startDate);
      if (endDate) filter.dueDate.$lte = new Date(endDate);
    }

    // Ensure current-month recurring bills exist when relevant
    try {
      const coversCurrentMonth =
        isDefaultList ||
        (startDate && new Date(startDate).toISOString().slice(0,7) === getCurrentMonth()) ||
        (endDate && new Date(endDate).toISOString().slice(0,7) === getCurrentMonth());
      if (coversCurrentMonth) {
        await generateRecurringBills();
      }
    } catch (err) {
      console.error('[Bill] generateRecurringBills error', err);
    }

    if (isDefaultList) {
      filter.dueDate = { $gte: currentMonthStart };
    }

    let bills = await Bill.find(filter).sort({ dueDate: 1 }).lean();
    
    // Compute dynamic status and filter if needed
    bills = bills.map(bill => ({
      ...bill,
      status: bill.status === "paid" ? "paid" : getBillStatus(bill.dueDate)
    }));
    
    if (status) {
      bills = bills.filter(bill => bill.status === status);
    }

    bills = await attachPaidDateToBills(bills);
    
    res.json({ success: true, data: bills });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch bills" });
  }
};

const createBill = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const {
      title,
      name,
      category,
      amount,
      dueDate,
      recurring = false,
      isRecurring = false,
      frequency,
      autoPay = false,
      notes,
      status
    } = req.body;
    const billTitle = (title || name || "").trim();
    if (!billTitle || !category || amount == null || !dueDate) {
      return res.status(400).json({ success: false, message: "title/name, category, amount and dueDate are required" });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "amount must be greater than 0" });
    }
    const payload = {
      familyId: req.user.familyId,
      createdBy: req.user._id,
      title: billTitle,
      category: category.trim().toLowerCase(),
      amount: Number(amount),
      dueDate: new Date(dueDate),
      isRecurring: Boolean(isRecurring || recurring),
      frequency: frequency ? frequency.trim().toLowerCase() : undefined,
      autoPay: Boolean(autoPay),
      notes: notes ? notes.trim() : undefined,
      status: getBillStatus(dueDate)
    };

    const bill = await Bill.create(payload);
    const actor = { id: req.user._id, name: req.user.name };
    socketService.emitToFamily(req.user.familyId, "billCreated", { data: bill, actor });
    res.status(201).json({ success: true, message: "Bill created", data: bill });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create bill" });
  }
};

const updateBill = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    const updates = req.body;
    if (updates.amount != null && Number(updates.amount) <= 0) {
      return res.status(400).json({ success: false, message: "amount must be greater than 0" });
    }
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }
    const bill = await Bill.findOneAndUpdate(
      { _id: id, familyId: req.user.familyId },
      { $set: updates },
      { new: true }
    );
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    const actor = { id: req.user._id, name: req.user.name };
    socketService.emitToFamily(req.user.familyId, "billUpdated", { data: bill, actor });
    res.json({ success: true, message: "Bill updated", data: bill });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update bill" });
  }
};

const deleteBill = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    const bill = await Bill.findOneAndDelete({ _id: id, familyId: req.user.familyId });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    await Reminder.deleteMany({ billId: bill._id });
    const actor = { id: req.user._id, name: req.user.name };
    socketService.emitToFamily(req.user.familyId, "billDeleted", { data: bill, actor });
    res.json({ success: true, message: "Bill deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete bill" });
  }
};

const markPaidBill = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    const { paidDate, paymentMethod, notes } = req.body;
    const bill = await Bill.findOne({ _id: id, familyId: req.user.familyId });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    const paidAt = paidDate ? new Date(paidDate) : new Date();
    const payment = await Payment.create({
      billId: bill._id,
      familyId: req.user.familyId,
      amount: bill.amount,
      paidDate: paidAt,
      paymentMethod: paymentMethod ? paymentMethod.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      createdBy: req.user._id
    });
    bill.status = "paid";
    await bill.save();
    const actor = { id: req.user._id, name: req.user.name };
    socketService.emitToFamily(req.user.familyId, "billPaid", { data: { bill, payment }, actor });
    res.json({ success: true, message: "Bill marked paid", data: { bill, payment } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to mark bill paid" });
  }
};

const skipBill = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    const bill = await Bill.findOne({ _id: id, familyId: req.user.familyId });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    bill.status = "skipped";
    await bill.save();
    const actor = { id: req.user._id, name: req.user.name };
    socketService.emitToFamily(req.user.familyId, "billSkipped", { data: bill, actor });
    res.json({ success: true, message: "Bill skipped", data: bill });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to skip bill" });
  }
};

const duplicateBill = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    const bill = await Bill.findOne({ _id: id, familyId: req.user.familyId }).lean();
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    const newDueDate = bill.isRecurring ? addFrequency(bill.dueDate, bill.frequency) : bill.dueDate;
    const duplicate = await Bill.create({
      familyId: bill.familyId,
      createdBy: req.user._id,
      title: bill.title,
      category: bill.category,
      amount: bill.amount,
      dueDate: newDueDate,
      isRecurring: bill.isRecurring,
      frequency: bill.frequency,
      autoPay: bill.autoPay,
      notes: bill.notes,
      status: getBillStatus(newDueDate)
    });
    const actor = { id: req.user._id, name: req.user.name };
    socketService.emitToFamily(req.user.familyId, "billCreated", { data: duplicate, actor });
    res.status(201).json({ success: true, message: "Bill duplicated", data: duplicate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to duplicate bill" });
  }
};

const getBillDashboard = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    const familyId = req.user.familyId ? req.user.familyId.toString() : null;
    if (!familyId || !mongoose.Types.ObjectId.isValid(familyId)) {
      return res.status(400).json({ success: false, message: "Invalid familyId" });
    }
    const familyObjectId = new mongoose.Types.ObjectId(familyId);
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [upcomingBillsCount, autoPayCount, overdueCount, categorySummary, calendarBills, paymentsThisMonth] = await Promise.all([
      Bill.countDocuments({ familyId: familyObjectId, dueDate: { $gte: today }, status: { $in: ["upcoming", "skipped"] } }),
      Bill.countDocuments({ familyId: familyObjectId, autoPay: true }),
      Bill.countDocuments({ familyId: familyObjectId, dueDate: { $lt: today }, status: { $nin: ["paid", "skipped"] } }),
      Bill.aggregate([
        { $match: { familyId: familyObjectId, status: { $in: ["upcoming", "overdue"] } } },
        { $group: { _id: "$category", amount: { $sum: "$amount" } } },
        { $sort: { amount: -1 } }
      ]),
      Bill.find({ familyId: familyObjectId, dueDate: { $gte: today, $lte: next30Days } }).sort({ dueDate: 1 }).lean(),
      Payment.aggregate([
        {
          $match: {
            familyId: familyObjectId,
            paidDate: {
              $gte: currentMonthStart,
              $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
            }
          }
        },
        { $group: { _id: null, totalPaid: { $sum: "$amount" } } }
      ])
    ]);

    const calendarBillsWithPaidDate = await attachPaidDateToBills(calendarBills);

    const totalDueResult = await Bill.aggregate([
      { $match: { familyId: familyObjectId, status: { $in: ["upcoming", "overdue"] } } },
      { $group: { _id: null, totalDue: { $sum: "$amount" } } }
    ]);
    const totalDue = totalDueResult[0]?.totalDue || 0;
    const paidThisMonth = paymentsThisMonth[0]?.totalPaid || 0;

    const recentPaidBills = await Payment.find({
      familyId: familyObjectId,
      paidDate: {
        $gte: currentMonthStart,
        $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
      }
    })
      .sort({ paidDate: -1 })
      .limit(5)
      .populate("billId", "title")
      .lean();

    const reminders = await Reminder.find({ familyId: familyObjectId })
      .populate("billId", "title dueDate status")
      .lean();
    const nextSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingReminders = reminders
      .filter((reminder) => {
        const bill = reminder.billId;
        if (!bill || !bill.dueDate) return false;
        const reminderDate = new Date(bill.dueDate);
        reminderDate.setDate(reminderDate.getDate() - reminder.daysBefore);
        const billStatus = bill.status === "paid" ? "paid" : getBillStatus(bill.dueDate);
        return reminderDate >= today && reminderDate <= nextSevenDays && billStatus !== "paid";
      })
      .map((reminder) => ({
        id: reminder._id,
        billId: reminder.billId._id,
        billTitle: reminder.billId.title,
        billAmount: reminder.billId.amount,
        dueDate: reminder.billId.dueDate,
        reminderType: reminder.reminderType,
        daysBefore: reminder.daysBefore,
        reminderTime: reminder.reminderTime,
        pushEnabled: reminder.pushEnabled,
        emailEnabled: reminder.emailEnabled,
        smsEnabled: reminder.smsEnabled
      }));

    res.json({
      success: true,
      data: {
        upcomingBillsCount,
        totalDue,
        paidThisMonth,
        overdueCount,
        autoPayCount,
        categorySummary: categorySummary.map((item) => ({
          category: item._id || "uncategorized",
          amount: item.amount,
          percentage: totalDue > 0 ? Math.round((item.amount / totalDue) * 100 * 100) / 100 : 0
        })),
        recentPaidBills: recentPaidBills.map((item) => ({
          id: item._id,
          billId: item.billId?._id,
          billTitle: item.billId?.title,
          amount: item.amount,
          paidDate: item.paidDate,
          paymentMethod: item.paymentMethod
        })),
        upcomingReminders,
        calendarEvents: calendarBillsWithPaidDate.map((bill) => ({
          date: bill.dueDate,
          billName: bill.title,
          status: bill.status === "paid" ? "paid" : getBillStatus(bill.dueDate),
          amount: bill.amount,
          paidDate: bill.paidDate
        }))
      }
    });
  } catch (error) {
    console.error("getBillDashboard error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bills dashboard" });
  }
};

const getBillCalendar = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    const { month, year } = req.query;
    const now = new Date();
    const selectedYear = Number(year) || now.getFullYear();
    const selectedMonth = typeof month !== "undefined" ? Number(month) - 1 : now.getMonth();
    const startDate = new Date(Date.UTC(selectedYear, selectedMonth, 1));
    const endDate = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999));
    let bills = await Bill.find({ familyId: req.user.familyId, dueDate: { $gte: startDate, $lte: endDate } })
      .sort({ dueDate: 1 })
      .lean();
    bills = await attachPaidDateToBills(bills);
    const data = bills.map((bill) => ({
      date: bill.dueDate,
      billName: bill.title,
      status: bill.status === "paid" ? "paid" : getBillStatus(bill.dueDate),
      amount: bill.amount,
      paidDate: bill.paidDate
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch bill calendar" });
  }
};

const getBillSummary = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    const { month, year } = req.query;
    const now = new Date();
    const parsedYear = Number(year);
    const selectedYear = Number.isInteger(parsedYear) ? parsedYear : now.getFullYear();
    const parsedMonth = Number(month);
    const selectedMonth = Number.isInteger(parsedMonth) ? parsedMonth - 1 : now.getMonth();
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    const familyId = req.user.familyId;
    const categoryBreakdown = await Bill.aggregate([
      {
        $match: {
          familyId,
          dueDate: { $gte: startDate, $lte: endDate }
        }
      },
      { $group: { _id: "$category", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } }
    ]);
    const total = categoryBreakdown.reduce((sum, item) => sum + (item.amount || 0), 0);
    res.json({
      success: true,
      data: categoryBreakdown.map((item) => ({
        category: item._id || "uncategorized",
        amount: item.amount || 0,
        percentage: total > 0 ? Math.round((item.amount / total) * 100 * 100) / 100 : 0
      }))
    });
  } catch (error) {
    console.error("getBillSummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bill summary" });
  }
};

module.exports = {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  markPaidBill,
  skipBill,
  duplicateBill,
  getBillDashboard,
  getBillCalendar,
  getBillSummary
};
