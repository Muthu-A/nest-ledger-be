const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rateLimiter = require("../middlewares/rateLimiter");

router.post("/signup", rateLimiter(), authController.signup);
router.post("/login", rateLimiter(), authController.login);
router.post("/logout", authMiddleware, authController.logout);
router.post("/forgot-password", rateLimiter(), authController.forgotPassword);
router.post("/reset-password", rateLimiter(), authController.resetPassword);
router.get("/me", authMiddleware, authController.me);

module.exports = router;
