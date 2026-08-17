const Reminder = require("../models/Reminder");
const Bill = require("../models/Bill");
const socketService = require("../services/socketService");

const getBillStatus = (dueDate) => {
  const now = new Date();
  const dueDateObj = new Date(dueDate);
  // Set due date to end of day for comparison
  dueDateObj.setHours(23, 59, 59, 999);
  if (dueDateObj < now) return "overdue";
  return "upcoming";
};

const requireFamilyContext = (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return false;
  }
  // allow personal (no familyId) context when user has no family
  return true;
};

const requireWriteAccess = (req, res) => {
  if (req.user?.role === "viewer") {
    res.status(403).json({ success: false, message: "Insufficient role" });
    return false;
  }
  return true;
};

const getReminders = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    const reminders = await Reminder.find({ familyId: req.user.familyId })
      .populate("billId", "title dueDate status amount")
      .sort({ createdAt: -1 })
      .lean();
    
    // Compute dynamic bill status
    const remindersWithComputedStatus = reminders.map(reminder => ({
      ...reminder,
      billId: reminder.billId ? {
        ...reminder.billId,
        status: reminder.billId.status === "paid" ? "paid" : getBillStatus(reminder.billId.dueDate)
      } : null
    }));
    
    res.json({ success: true, data: remindersWithComputedStatus });
  } catch (error) {
    console.error("getReminders error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reminders" });
  }
};

const createReminder = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { billId, reminderType = "push", daysBefore = 1, reminderTime = "08:00", pushEnabled = true, emailEnabled = false, smsEnabled = false } = req.body;
    if (!billId) {
      return res.status(400).json({ success: false, message: "billId is required" });
    }
    const validReminderTypes = ["push", "email", "sms", "all"];
    const normalizedReminderType = reminderType.toString().trim().toLowerCase();
    if (!validReminderTypes.includes(normalizedReminderType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reminderType: ${normalizedReminderType}. Accepted values: ${validReminderTypes.join(", ")}`
      });
    }
    const familyId = req.user.familyId;
    const bill = await Bill.findOne({ _id: billId, familyId });
    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found for this family" });
    }
    const reminder = await Reminder.create({
      billId,
      familyId,
      reminderType: normalizedReminderType,
      daysBefore: Math.max(0, Number(daysBefore)),
      reminderTime,
      pushEnabled: Boolean(pushEnabled),
      emailEnabled: Boolean(emailEnabled),
      smsEnabled: Boolean(smsEnabled)
    });
    socketService.emitToFamily(familyId, "billReminder", { data: reminder });
    res.status(201).json({ success: true, message: "Reminder created", data: reminder });
  } catch (error) {
    console.error("createReminder error:", error);
    res.status(500).json({ success: false, message: "Failed to create reminder" });
  }
};

const updateReminder = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    
    // Only allow specific fields to be updated
    const allowedFields = ['reminderType', 'daysBefore', 'reminderTime', 'pushEnabled', 'emailEnabled', 'smsEnabled', 'billId'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    });
    
    // Verify bill ownership if billId is being updated
    if (updates.billId) {
      const bill = await Bill.findOne({ _id: updates.billId, familyId: req.user.familyId });
      if (!bill) {
        return res.status(404).json({ success: false, message: "Bill not found for this family" });
      }
    }
    
    const reminder = await Reminder.findOneAndUpdate(
      { _id: id, familyId: req.user.familyId },
      { $set: updates },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ success: false, message: "Reminder not found" });
    res.json({ success: true, message: "Reminder updated", data: reminder });
  } catch (error) {
    console.error("updateReminder error:", error);
    res.status(500).json({ success: false, message: "Failed to update reminder" });
  }
};

const deleteReminder = async (req, res) => {
  try {
    if (!requireFamilyContext(req, res)) return;
    if (!requireWriteAccess(req, res)) return;
    const { id } = req.params;
    const reminder = await Reminder.findOneAndDelete({ _id: id, familyId: req.user.familyId });
    if (!reminder) return res.status(404).json({ success: false, message: "Reminder not found" });
    res.json({ success: true, message: "Reminder deleted" });
  } catch (error) {
    console.error("deleteReminder error:", error);
    res.status(500).json({ success: false, message: "Failed to delete reminder" });
  }
};

module.exports = {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder
};
