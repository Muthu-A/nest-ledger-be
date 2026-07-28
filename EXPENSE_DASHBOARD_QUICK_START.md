# Expense Dashboard - Quick Start Guide

## 🎯 What Was Created

A new REST API endpoint: **`GET /api/expenses/dashboard`** that returns comprehensive expense analytics for a selected month.

---

## 📍 Endpoint Location

```
GET /api/expenses/dashboard?month=YYYY-MM
```

**Example:**
```
GET /api/expenses/dashboard?month=2026-07
```

---

## 🔐 Authentication Required
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📊 What It Returns

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalExpenses": 2500.50,
      "expenseChangePercentage": 12.5,
      "averageMonthlyExpense": 2300.25,
      "averageChangePercentage": 8.75,
      "highestExpense": {
        "amount": 450,
        "category": "groceries",
        "date": "2026-07-15T00:00:00.000Z"
      },
      "totalTransactions": 42
    },
    "monthlyTrend": [
      { "month": "2026-02", "expense": 2100, "transactions": 38 },
      { "month": "2026-03", "expense": 2450, "transactions": 45 }
      // ... up to 6 months
    ],
    "categoryBreakdown": [
      { "category": "groceries", "amount": 850, "percentage": 34 },
      { "category": "utilities", "amount": 450.5, "percentage": 18 }
      // ... all categories
    ]
  }
}
```

---

## 🚀 How to Use

### Option 1: Using cURL
```bash
curl -X GET "http://localhost:5000/api/expenses/dashboard?month=2026-07" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Option 2: Using JavaScript/Node.js
```javascript
const response = await fetch('http://localhost:5000/api/expenses/dashboard?month=2026-07', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

### Option 3: Using Python
```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
}

response = requests.get(
    'http://localhost:5000/api/expenses/dashboard?month=2026-07',
    headers=headers
)

print(response.json())
```

---

## 🧪 Test the Implementation

```bash
# Start the server
npm run dev

# In another terminal, run the test
TEST_AUTH_TOKEN="your-jwt-token" node test/expenseDashboardTest.js
```

---

## 📂 Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/controllers/dashboard.controller.js` | Modified | Added `getExpenseDashboard()` method |
| `src/routes/expense.routes.js` | Modified | Added new route for dashboard endpoint |
| `test/expenseDashboardTest.js` | Created | Test suite for the endpoint |
| `EXPENSE_DASHBOARD_API.md` | Created | Complete API documentation |
| `IMPLEMENTATION_SUMMARY.md` | Created | Implementation details and architecture |

---

## 🎛️ Query Parameters

| Parameter | Type | Required | Format | Example |
|-----------|------|----------|--------|---------|
| `month` | string | Yes | `YYYY-MM` | `2026-07` |

---

## 📈 Metrics Explained

| Metric | Calculation | Notes |
|--------|-----------|-------|
| `totalExpenses` | Sum of all expenses in the month | Basic aggregation |
| `totalTransactions` | Count of expense documents | Number of transactions |
| `expenseChangePercentage` | (Current - Previous) / Previous × 100 | Month-over-month comparison |
| `highestExpense` | Maximum amount expense | Single highest transaction |
| `averageMonthlyExpense` | Average of last 3 months | Includes selected month |
| `averageChangePercentage` | Current 3mo avg vs Previous 3mo avg | Trend comparison |
| `monthlyTrend` | Last 6 months data | Chronologically ordered |
| `categoryBreakdown` | Expenses grouped by category | Percentage of total |

---

## ✅ Key Features

✨ **Efficient**: Uses MongoDB aggregation pipelines
✨ **Secure**: Filters by user's family ID
✨ **Comprehensive**: Multiple analytics metrics
✨ **Flexible**: Works with any month in the past
✨ **Robust**: Handles edge cases and missing data
✨ **Standard**: Follows project architecture patterns

---

## ❌ Error Handling

### Invalid Month Format
```json
{
  "success": false,
  "message": "Invalid month format. Use YYYY-MM"
}
```

### Missing Authentication
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### Missing Family ID
```json
{
  "success": false,
  "message": "Family ID is required"
}
```

---

## 💡 Tips

1. **Current Month**: Use today's date to get current month analytics
2. **Previous Months**: Go back as far as you have expense data
3. **No Data**: Returns 0 for all metrics if no expenses exist
4. **Performance**: Queries are optimized with MongoDB aggregation
5. **Caching**: Consider implementing caching for frequently accessed months

---

## 📚 For More Details

- **Complete API Documentation**: See [EXPENSE_DASHBOARD_API.md](EXPENSE_DASHBOARD_API.md)
- **Implementation Details**: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Test Suite**: See [test/expenseDashboardTest.js](test/expenseDashboardTest.js)

---

## 🔄 Important Note

The original `GET /api/expenses` endpoint is **NOT modified** and continues to work as before. It returns:
- Individual expense transactions
- Filters by family ID and month
- Useful for transaction-level details

The new `GET /api/expenses/dashboard` endpoint provides:
- Aggregated analytics
- Summary metrics
- Trends and breakdowns
- Useful for dashboard visualizations

---

## 🎉 Ready to Use!

The endpoint is fully integrated and ready for production. Start using it to power your expense dashboard features!
