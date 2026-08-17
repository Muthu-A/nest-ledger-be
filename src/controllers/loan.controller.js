const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const LoanRepayment = require("../models/LoanRepayment");

const buildOwnershipFilter = (req) => {
  const userId = req.user && req.user._id ? req.user._id : req.user && req.user.id ? req.user.id : null;
  if (!userId) return { userId: null };
  if (req.user && req.user.familyId) {
    return { $or: [{ userId }, { familyId: req.user.familyId }] };
  }
  return { userId };
};

const isValidObjectId = (id) => {
  return id && mongoose.Types.ObjectId.isValid(id);
};

const computeLoanStatus = (amount, amountSettled) => {
  if (amountSettled <= 0) return "pending";
  if (amountSettled >= amount) return "settled";
  return "partial";
};

exports.createLoan = async (req, res) => {
  try {
    const { type, personName, amount, dueDate, notes } = req.body || {};

    if (!type || !["lent", "borrowed"].includes(type)) {
      return res.status(400).json({ message: "type is required and must be 'lent' or 'borrowed'" });
    }
    if (!personName || typeof personName !== "string" || !personName.trim()) {
      return res.status(400).json({ message: "personName is required" });
    }
    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const loan = await Loan.create({
      userId: req.user._id || req.user.id,
      familyId: req.user.familyId || null,
      type,
      personName: personName.trim(),
      amount: parsedAmount,
      amountSettled: 0,
      status: "pending",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes ? String(notes).trim() : null,
    });

    res.status(201).json(loan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create loan" });
  }
};

exports.getLoans = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const filter = buildOwnershipFilter(req);

    if (req.query.type) {
      if (!["lent", "borrowed"].includes(req.query.type)) {
        return res.status(400).json({ message: "Invalid type" });
      }
      filter.type = req.query.type;
    }
    if (req.query.status) {
      if (!["pending", "partial", "settled"].includes(req.query.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      filter.status = req.query.status;
    }

    const [loans, total] = await Promise.all([
      Loan.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments(filter),
    ]);

    const loansWithStatus = loans.map((loan) => ({
      ...loan,
      loanStatus: loan.isOpen !== false ? "open" : "closed",
    }));

    res.json({
      loans: loansWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch loans" });
  }
};

exports.getLoanById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }
    const filter = { _id: id, ...buildOwnershipFilter(req) };
    const loan = await Loan.findOne(filter).lean();
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const repayments = await LoanRepayment.find({ loanId: loan._id }).sort({ date: -1 }).lean();
    res.json({ 
      loan: {
        ...loan,
        loanStatus: loan.isOpen !== false ? "open" : "closed"
      }, 
      repayments 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch loan" });
  }
};

exports.updateLoan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }
    const { personName, amount, dueDate, notes } = req.body || {};
    const loan = await Loan.findOne({ _id: id, ...buildOwnershipFilter(req) });
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const updates = {};
    if (personName !== undefined) {
      if (!personName || typeof personName !== "string" || !personName.trim()) {
        return res.status(400).json({ message: "personName is required" });
      }
      updates.personName = personName.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }
      if (parsedAmount < loan.amountSettled) {
        return res.status(400).json({ message: "amount cannot be less than amountSettled" });
      }
      updates.amount = parsedAmount;
    }

    if (dueDate !== undefined) {
      updates.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (notes !== undefined) {
      updates.notes = notes ? String(notes).trim() : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update" });
    }

    if (updates.amount !== undefined) {
      loan.amount = updates.amount;
    }
    if (updates.personName !== undefined) {
      loan.personName = updates.personName;
    }
    if (updates.dueDate !== undefined) {
      loan.dueDate = updates.dueDate;
    }
    if (updates.notes !== undefined) {
      loan.notes = updates.notes;
    }

    loan.status = computeLoanStatus(loan.amount, loan.amountSettled);
    await loan.save();

    res.json(loan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update loan" });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }
    const loan = await Loan.findOne({ _id: id, ...buildOwnershipFilter(req) });
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    // Delete all associated repayments first
    await LoanRepayment.deleteMany({ loanId: loan._id });
    
    // Then delete the loan
    await Loan.deleteOne({ _id: loan._id });
    res.json({ message: "Loan and associated repayments deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete loan" });
  }
};

exports.addLoanRepayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }
    const { amount, date, notes } = req.body || {};

    const loan = await Loan.findOne({ _id: id, ...buildOwnershipFilter(req) });
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const repaymentAmount = Number(amount);
    if (Number.isNaN(repaymentAmount) || repaymentAmount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const remaining = loan.amount - loan.amountSettled;
    if (repaymentAmount > remaining) {
      return res.status(400).json({ message: "Repayment amount cannot exceed remaining loan balance" });
    }

    const repayment = await LoanRepayment.create({
      loanId: loan._id,
      amount: repaymentAmount,
      date: date ? new Date(date) : new Date(),
      notes: notes ? String(notes).trim() : null,
    });

    loan.amountSettled = Number((loan.amountSettled + repaymentAmount).toFixed(2));
    loan.status = computeLoanStatus(loan.amount, loan.amountSettled);
    await loan.save();

    res.status(201).json({ repayment, loan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add repayment" });
  }
};

exports.getLoanSummary = async (req, res) => {
  try {
    const loanFilter = buildOwnershipFilter(req);

    const loans = await Loan.find(loanFilter).lean();
    const totalLent = loans.filter((loan) => loan.type === "lent").reduce((sum, loan) => sum + (loan.amount || 0), 0);
    const totalBorrowed = loans.filter((loan) => loan.type === "borrowed").reduce((sum, loan) => sum + (loan.amount || 0), 0);
    const totalPendingToReceive = loans
      .filter((loan) => loan.type === "lent")
      .reduce((sum, loan) => sum + Math.max(0, (loan.amount || 0) - (loan.amountSettled || 0)), 0);
    const totalPendingToPay = loans
      .filter((loan) => loan.type === "borrowed")
      .reduce((sum, loan) => sum + Math.max(0, (loan.amount || 0) - (loan.amountSettled || 0)), 0);

    res.json({
      totalLent,
      totalBorrowed,
      totalPendingToReceive,
      totalPendingToPay,
      netPosition: totalPendingToReceive - totalPendingToPay,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch loan summary" });
  }
};

exports.closeLoan = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: id, ...buildOwnershipFilter(req) });
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (!loan.isOpen) {
      return res.status(400).json({ message: "Loan is already closed" });
    }

    loan.isOpen = false;
    await loan.save();

    res.json({ message: "Loan closed successfully", loan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to close loan" });
  }
};

exports.getLoanRepayments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: id, ...buildOwnershipFilter(req) }).lean();
    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [repayments, total] = await Promise.all([
      LoanRepayment.find({ loanId: loan._id })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanRepayment.countDocuments({ loanId: loan._id }),
    ]);

    res.json({
      loanId: loan._id,
      loanAmount: loan.amount,
      amountSettled: loan.amountSettled,
      repayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch repayments" });
  }
};
