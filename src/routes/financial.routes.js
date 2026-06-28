const express = require("express");
const router = express.Router();
const { getPlannerData } = require("../controllers/financial.controller");

router.get("/planner", getPlannerData);

module.exports = router;
