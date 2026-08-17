const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

const generateToken = (userId) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign({ id: userId }, jwtSecret, {
    expiresIn: "7d",
  });
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validatePassword = (pw) => {
  return typeof pw === "string" && pw.length >= 8;
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: "Name, email and password are required", code: "VALIDATION_ERROR" });
    
    // Validate input lengths
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return res.status(400).json({ success: false, error: "Invalid name (must be 1-100 characters)", code: "VALIDATION_ERROR" });
    }
    
    if (!validateEmail(email)) return res.status(400).json({ success: false, error: "Invalid email format", code: "INVALID_EMAIL" });
    if (!validatePassword(password)) return res.status(400).json({ success: false, error: "Password must be at least 8 characters", code: "WEAK_PASSWORD" });
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, error: "Email already registered", code: "EMAIL_EXISTS" });
    
    const user = await User.create({ name: name.trim(), email: email.toLowerCase(), password });
    const token = generateToken(user._id);
    return res.status(201).json({ success: true, data: { token, user: { id: user._id, email: user.email, name: user.name, familyId: user.familyId || null, role: user.role || null } }, message: "User created" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: "Email and password required", code: "VALIDATION_ERROR" });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    const token = generateToken(user._id);
    return res.json({ success: true, data: { token, user: { id: user._id, email: user.email, name: user.name }, familyId: user.familyId || null, role: user.role || null }, message: "Logged in" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.logout = async (req, res) => {
  return res.json({ success: true, message: "Logged out successfully" });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = await User.findOne({ email: email.toLowerCase() });
    // Do not generate tokens in backend; frontend can call reset directly with email and new password
    // Respond generically to avoid leaking account existence
    if (!user) return res.status(200).json({ message: "If that email exists, follow reset instructions" });
    // Optionally clear any existing reset tokens
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: "If that email exists, follow reset instructions" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and new password required" });
    if (!validatePassword(password)) return res.status(400).json({ success: false, error: "Password must be at least 8 characters", code: "WEAK_PASSWORD" });
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Generic response to prevent account enumeration
      return res.status(200).json({ message: "If that account exists, password has been reset" });
    }
    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    return res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" });
    const user = req.user;
    return res.json({ success: true, data: { user: { id: user._id, email: user.email, name: user.name }, familyId: user.familyId || null, role: user.role || null } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error", code: "SERVER_ERROR" });
  }
};
