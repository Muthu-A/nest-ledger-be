const NotificationToken = require("../models/NotificationToken");
const { sendNotification } = require("../services/notification.service");

exports.registerToken = async (req, res) => {
  try {
    const { token, deviceType, platform } = req.body;
    const userId = req.user && req.user.id ? req.user.id : req.user && req.user._id ? req.user._id : null;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await NotificationToken.updateOne(
      { token },
      {
        userId,
        token,
        deviceType,
        platform,
        lastUsedAt: new Date(),
      },
      {
        upsert: true,
      }
    );

    res.json({ success: true, message: "Notification token registered" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to register token" });
  }
};

exports.sendTestNotification = async (req, res) => {
  try {
    const { token, data } = req.body;
    let tokens = [];

    if (token) {
      tokens = [token];
    } else if (req.user && req.user.id) {
      const savedTokens = await NotificationToken.find({ userId: req.user.id }).lean();
      tokens = savedTokens.map((item) => item.token);
    }

    if (!tokens.length) {
      return res.status(400).json({ message: "No tokens available to send notification" });
    }

    const response = await sendNotification(tokens, "Nest Ledger", "Push Notification Working", data);
    res.json({ success: true, message: "Test notification sent", response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send test notification" });
  }
};
