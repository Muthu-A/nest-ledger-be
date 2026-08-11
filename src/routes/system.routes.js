const express = require('express');
const router = express.Router();
const { triggerBudgets, triggerBills, triggerReminders } = require('../controllers/system.controller');
const auth = require('../middlewares/auth.middleware');

// Admin/manual endpoints. Protect with auth + role checks if desired.
router.post('/budgets', auth, triggerBudgets);
router.post('/bills', auth, triggerBills);
router.post('/reminders', auth, triggerReminders);

module.exports = router;
