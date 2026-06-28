const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const {
  registerToken,
  sendTestNotification,
} = require("../controllers/notification.controller");

router.post("/register-token", auth, registerToken);
router.post("/test", auth, sendTestNotification);

module.exports = router;
