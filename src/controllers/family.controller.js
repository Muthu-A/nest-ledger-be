const crypto = require("crypto");
const Family = require("../models/Family");
const FamilyMember = require("../models/FamilyMember");
const Invitation = require("../models/Invitation");
const User = require("../models/User");

const generateCode = (len = 10) => {
  return crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
};

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

exports.createFamily = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || String(name).trim() === "") return res.status(400).json({ success: false, error: "Family name required", code: "VALIDATION_ERROR" });
    if (String(name).length > 50) return res.status(400).json({ success: false, error: "Family name too long", code: "VALIDATION_ERROR" });
    // check duplicate
    const existing = await Family.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ success: false, error: "Family name already exists", code: "FAMILY_EXISTS" });
    // create family
    const family = await Family.create({ name: name.trim(), ownerId: req.user._id });
    await FamilyMember.create({ familyId: family._id, userId: req.user._id, role: "owner", joinedAt: new Date() });
    // update user
    await User.findByIdAndUpdate(req.user._id, { familyId: family._id, role: "owner" });
    return res.status(201).json({ success: true, data: { familyId: family._id }, message: "Family created successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

const ensureMember = async (familyId, userId) => {
  return FamilyMember.findOne({ familyId, userId });
};

exports.getFamily = async (req, res) => {
  try {
    const { familyId } = req.params;
    const membership = await ensureMember(familyId, req.user._id);
    if (!membership) return res.status(403).json({ success: false, error: "Not a family member", code: "FORBIDDEN" });
    const family = await Family.findById(familyId).lean();
    if (!family) return res.status(404).json({ success: false, error: "Family not found", code: "NOT_FOUND" });
    const members = await FamilyMember.find({ familyId }).populate("userId", "name email").lean();

    // fetch pending invitations and combine with joined member events as recent activities
    const invitations = await Invitation.find({ familyId }).lean();

    const inviteActivities = invitations.map((inv) => ({
      type: "invitation",
      email: inv.email,
      invitationCode: inv.invitationCode,
      sendTime: inv.createdAt,
      expiresAt: inv.expiresAt,
      status: inv.expiresAt && new Date(inv.expiresAt) > new Date() ? "pending" : "expired",
    }));

    const joinedActivities = members
      .filter((m) => m.userId)
      .map((m) => ({
        type: "joined",
        userId: m.userId._id || m.userId,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        joinedAt: m.joinedAt,
        status: "joined",
      }));

    const recentActivities = [...inviteActivities, ...joinedActivities].sort((a, b) => {
      const ta = new Date(a.sendTime || a.joinedAt || 0).getTime();
      const tb = new Date(b.sendTime || b.joinedAt || 0).getTime();
      return tb - ta;
    });

    return res.json({ success: true, data: { family, members, recentActivities } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.getFamiliesForUser = async (req, res) => {
  try {
    const memberships = await FamilyMember.find({ userId: req.user._id }).populate("familyId");
    const families = memberships.map((m) => ({ family: m.familyId, role: m.role, joinedAt: m.joinedAt }));
    return res.json({ success: true, data: { families } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.deleteFamily = async (req, res) => {
  try {
    const { familyId } = req.params;
    const membership = await FamilyMember.findOne({ familyId, userId: req.user._id });
    if (!membership || membership.role !== "owner") return res.status(403).json({ success: false, error: "Only owner can delete family", code: "FORBIDDEN" });
    // clear users
    const members = await FamilyMember.find({ familyId });
    const userIds = members.map((m) => m.userId);
    await User.updateMany({ _id: { $in: userIds } }, { $set: { familyId: null, role: null } });
    await FamilyMember.deleteMany({ familyId });
    await Invitation.deleteMany({ familyId });
    await Family.findByIdAndDelete(familyId);
    return res.json({ success: true, message: "Family deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.inviteMember = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, error: "Valid email required", code: "VALIDATION_ERROR" });
    const membership = await FamilyMember.findOne({ familyId, userId: req.user._id });
    if (!membership || membership.role !== "owner") return res.status(403).json({ success: false, error: "Only owner can invite members", code: "FORBIDDEN" });
    // check if email already in family
    const invitedUser = await User.findOne({ email: email.toLowerCase() });
    if (invitedUser) {
      const already = await FamilyMember.findOne({ familyId, userId: invitedUser._id });
      if (already) return res.status(400).json({ success: false, error: "User already in family", code: "ALREADY_MEMBER" });
    }
    const code = generateCode(10);
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
    const invitation = await Invitation.create({ familyId, email: email.toLowerCase(), invitationCode: code, expiresAt });
    const link = `${process.env.FRONTEND_URL || "http://localhost:3000"}/join?code=${code}`;
    return res.status(201).json({ success: true, data: { invitationCode: code, expiresAt, link }, message: "Invitation created" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.acceptInvitation = async (req, res) => {
  try {
    const { invitationCode } = req.params;
    const raw = String(invitationCode || "");
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const invitation = await Invitation.findOne({ invitationCode: { $regex: `^${esc}$`, $options: "i" } });
    if (!invitation) return res.status(400).json({ success: false, error: "Invalid invitation code", code: "INVALID_INVITE" });
    if (invitation.expiresAt < new Date()) {
      await invitation.deleteOne();
      return res.status(400).json({ success: false, error: "Invitation expired", code: "INVITE_EXPIRED" });
    }
    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) return res.status(403).json({ success: false, error: "Invitation not for your account", code: "FORBIDDEN" });
    if (req.user.familyId) return res.status(400).json({ success: false, error: "User already belongs to a family", code: "ALREADY_IN_FAMILY" });
    const exists = await FamilyMember.findOne({ familyId: invitation.familyId, userId: req.user._id });
    if (exists) {
      await invitation.deleteOne();
      return res.json({ success: true, message: "Already a member" });
    }
    await FamilyMember.create({ familyId: invitation.familyId, userId: req.user._id, role: "editor", joinedAt: new Date() });
    await User.findByIdAndUpdate(req.user._id, { familyId: invitation.familyId, role: "editor" });
    await invitation.deleteOne();
    return res.json({ success: true, data: { familyId: invitation.familyId, role: "editor" }, message: "Joined family successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.rejectInvitation = async (req, res) => {
  try {
    const { invitationCode } = req.params;
    const raw = String(invitationCode || "");
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const invitation = await Invitation.findOne({ invitationCode: { $regex: `^${esc}$`, $options: "i" } });
    if (!invitation) return res.status(400).json({ success: false, error: "Invalid invitation code", code: "INVALID_INVITE" });
    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) return res.status(403).json({ success: false, error: "Invitation not for your account", code: "FORBIDDEN" });
    await invitation.deleteOne();
    return res.json({ success: true, message: "Invitation rejected" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.listMembers = async (req, res) => {
  try {
    const { familyId } = req.params;
    const membership = await FamilyMember.findOne({ familyId, userId: req.user._id });
    if (!membership) return res.status(403).json({ success: false, error: "Not a family member", code: "FORBIDDEN" });
    const members = await FamilyMember.find({ familyId }).populate("userId", "name email");
    return res.json({ success: true, data: { members } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { familyId, userId } = req.params;
    const requester = await FamilyMember.findOne({ familyId, userId: req.user._id });
    if (!requester || requester.role !== "owner") return res.status(403).json({ success: false, error: "Only owner can remove members", code: "FORBIDDEN" });
    if (String(req.user._id) === String(userId)) return res.status(400).json({ success: false, error: "Cannot remove yourself", code: "INVALID_OPERATION" });
    const target = await FamilyMember.findOne({ familyId, userId });
    if (!target) return res.status(404).json({ success: false, error: "Member not found", code: "NOT_FOUND" });
    await target.deleteOne();
    // update removed user
    await User.findByIdAndUpdate(userId, { familyId: null, role: null });
    return res.json({ success: true, message: "Member removed successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.changeRole = async (req, res) => {
  try {
    const { familyId, userId } = req.params;
    const { role } = req.body;
    if (!["owner", "editor", "viewer"].includes(role)) return res.status(400).json({ success: false, error: "Invalid role", code: "VALIDATION_ERROR" });
    const requester = await FamilyMember.findOne({ familyId, userId: req.user._id });
    if (!requester || requester.role !== "owner") return res.status(403).json({ success: false, error: "Only owner can change roles", code: "FORBIDDEN" });
    const target = await FamilyMember.findOne({ familyId, userId });
    if (!target) return res.status(404).json({ success: false, error: "Member not found", code: "NOT_FOUND" });
    // handle owner transfer
    if (role === "owner") {
      // set new owner in family
      await Family.findByIdAndUpdate(familyId, { ownerId: target.userId });
      // demote requester to editor
      await FamilyMember.findOneAndUpdate({ familyId, userId: req.user._id }, { role: "editor" });
      await User.findByIdAndUpdate(req.user._id, { role: "editor" });
    }
    target.role = role;
    await target.save();
    // update user's role field
    await User.findByIdAndUpdate(target.userId, { role });
    return res.json({ success: true, data: { role }, message: "Role updated successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.leaveFamily = async (req, res) => {
  try {
    const { familyId } = req.params;
    const membership = await FamilyMember.findOne({ familyId, userId: req.user._id });
    if (!membership) return res.status(403).json({ success: false, error: "Not a family member", code: "FORBIDDEN" });
    if (membership.role === "owner") {
      const ownerCount = await FamilyMember.countDocuments({ familyId, role: "owner" });
      if (ownerCount <= 1) return res.status(400).json({ success: false, error: "Cannot leave family with no owner", code: "NO_OWNER" });
    }
    await membership.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { familyId: null, role: null });
    return res.json({ success: true, message: "Left family successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.getInvitationDetails = async (req, res) => {
  try {
    const { invitationCode } = req.params;
    const raw = String(invitationCode || "");
    const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const invitation = await Invitation.findOne({ invitationCode: { $regex: `^${esc}$`, $options: "i" } });
    if (!invitation) return res.status(404).json({ success: false, error: "Invitation not found", code: "NOT_FOUND" });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ success: false, error: "Invitation expired", code: "INVITE_EXPIRED" });
    const family = await Family.findById(invitation.familyId).lean();
    return res.json({
      success: true,
      data: {
        invitation: {
          email: invitation.email,
          invitationCode: invitation.invitationCode,
          expiresAt: invitation.expiresAt,
          family: family ? { _id: family._id, name: family.name } : null,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};
