const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const advancedFormat = require('dayjs/plugin/advancedFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(advancedFormat);

const DEFAULT_TZ = process.env.TZ || 'UTC';

function getNow() {
  return dayjs().tz(DEFAULT_TZ);
}

function getCurrentMonth() {
  return getNow().format('YYYY-MM');
}

function getPreviousMonth() {
  return getNow().subtract(1, 'month').format('YYYY-MM');
}

function startOfMonth(date) {
  return dayjs(date).startOf('month').toDate();
}

function endOfMonth(date) {
  return dayjs(date).endOf('month').toDate();
}

function addMonths(date, n) {
  return dayjs(date).add(n, 'month').toDate();
}

function addWeeks(date, n) {
  return dayjs(date).add(n, 'week').toDate();
}

function addDays(date, n) {
  return dayjs(date).add(n, 'day').toDate();
}

function isSameMonth(dateA, dateB) {
  return dayjs(dateA).format('YYYY-MM') === dayjs(dateB).format('YYYY-MM');
}

module.exports = {
  getNow,
  getCurrentMonth,
  getPreviousMonth,
  addMonths,
  addWeeks,
  addDays,
  isSameMonth,
  startOfMonth,
  endOfMonth
};
