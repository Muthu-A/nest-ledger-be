const express = require("express");
const router = express.Router();

const {
  getIncomes,
  createIncome,
  updateIncome,
  deleteIncome
} = require("../controllers/income.controller");
const auth = require("../middlewares/auth.middleware");

router.get("/", auth, getIncomes);
router.post("/", auth, createIncome);
router.put("/:id", auth, updateIncome);
router.delete("/:id", auth, deleteIncome);

module.exports = router;
