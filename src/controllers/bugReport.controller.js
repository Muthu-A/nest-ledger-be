const BugReport = require("../models/BugReport");

const ALLOWED_STATUSES = ["open", "in_progress", "resolved", "closed"];

const getUserIdentifier = (user) => {
  if (!user) return null;
  if (user._id) return user._id.toString();
  if (user.id) return user.id.toString();
  return null;
};

const isAdminUser = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (process.env.ADMIN_EMAIL) {
    return user.email && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
  }
  return false;
};

const serializeBugReport = (report) => {
  const id = report._id ? report._id.toString() : report.id;
  return {
    id,
    type: report.type,
    description: report.description,
    userId: report.userId ? report.userId.toString() : null,
    userName: report.userName || null,
    userEmail: report.userEmail || null,
    familyId: report.familyId ? report.familyId.toString() : null,
    pageUrl: report.pageUrl || null,
    userAgent: report.userAgent || null,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
};

exports.createBugReport = async (req, res) => {
  try {
    const { type, description, pageUrl, userAgent } = req.body || {};

    if (!type || !["bug", "feedback"].includes(type)) {
      return res.status(400).json({ message: "type is required and must be either 'bug' or 'feedback'" });
    }

    if (typeof description !== "string") {
      return res.status(400).json({ message: "description is required" });
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 5) {
      return res.status(400).json({ message: "description must be at least 5 characters" });
    }

    if (trimmedDescription.length > 1000) {
      return res.status(400).json({ message: "description must not exceed 1000 characters" });
    }

    if (pageUrl !== undefined && typeof pageUrl !== "string") {
      return res.status(400).json({ message: "pageUrl must be a string" });
    }

    if (userAgent !== undefined && typeof userAgent !== "string") {
      return res.status(400).json({ message: "userAgent must be a string" });
    }

    const userId = getUserIdentifier(req.user);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const bugReport = await BugReport.create({
      type,
      description: trimmedDescription,
      userId,
      userName: req.user.name || null,
      userEmail: req.user.email || null,
      familyId: req.user.familyId || null,
      pageUrl: pageUrl ? pageUrl.trim() : null,
      userAgent: userAgent ? userAgent.trim() : null,
    });

    res.status(201).json(serializeBugReport(bugReport));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create bug report" });
  }
};

exports.updateBugReportStatus = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const bugReport = await BugReport.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();

    if (!bugReport) {
      return res.status(404).json({ message: "Bug report not found" });
    }

    res.json(serializeBugReport(bugReport));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update bug report status" });
  }
};

exports.getBugReports = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.type) {
      if (!["bug", "feedback"].includes(req.query.type)) {
        return res.status(400).json({ message: "Invalid type" });
      }
      filter.type = req.query.type;
    }

    if (req.query.status) {
      if (!ALLOWED_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      filter.status = req.query.status;
    }

    const [reports, total] = await Promise.all([
      BugReport.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BugReport.countDocuments(filter),
    ]);

    res.json({
      reports: reports.map(serializeBugReport),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bug reports" });
  }
};
