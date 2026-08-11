const User = require("../models/User");
const Family = require("../models/Family");
const FamilyMember = require("../models/FamilyMember");
const mongoose = require("mongoose");

const isAdminUser = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (process.env.ADMIN_EMAIL) {
    return user.email && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
  }
  return false;
};

exports.getUsers = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Collect unique family IDs
    const familyIds = [...new Set(users.map(u => u.familyId).filter(Boolean))];

    // Fetch families and member counts
    const familiesData = {};
    if (familyIds.length > 0) {
      const families = await Family.find({ _id: { $in: familyIds } }).lean();
      const memberCounts = await FamilyMember.aggregate([
        { $match: { familyId: { $in: familyIds } } },
        { $group: { _id: "$familyId", count: { $sum: 1 } } }
      ]);

      families.forEach(family => {
        familiesData[family._id.toString()] = {
          name: family.name,
          memberCount: 0
        };
      });

      memberCounts.forEach(item => {
        const familyIdStr = item._id.toString();
        if (familiesData[familyIdStr]) {
          familiesData[familyIdStr].memberCount = item.count;
        }
      });
    }

    const results = users.map((user) => ({
      id: user._id,
      name: user.name || null,
      email: user.email || null,
      familyId: user.familyId ? user.familyId.toString() : null,
      family: user.familyId ? familiesData[user.familyId.toString()] || null : null,
      role: user.role || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.json({
      users: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};
