# Expense Dashboard API Endpoint

## Overview
The Expense Dashboard endpoint provides comprehensive expense analytics for a family, aggregated for a specific month. It returns summary metrics, monthly trends, and category breakdowns.

**Endpoint:** `GET /api/expenses/dashboard`

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `month` (required): Month in `YYYY-MM` format (e.g., `2026-07`)

---

## Response Format

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalExpenses": number,
      "expenseChangePercentage": number,
      "averageMonthlyExpense": number,
      "averageChangePercentage": number,
      "highestExpense": {
        "amount": number,
        "category": string,
        "date": "ISO8601 Date"
      },
      "totalTransactions": number
    },
    "monthlyTrend": [
      {
        "month": "YYYY-MM",
        "expense": number,
        "transactions": number
      }
    ],
    "categoryBreakdown": [
      {
        "category": string,
        "amount": number,
        "percentage": number
      }
    ]
  }
}
```

---

## Response Fields

### Summary Object

| Field | Type | Description |
|-------|------|-------------|
| `totalExpenses` | number | Sum of all expenses in the selected month |
| `expenseChangePercentage` | number | Percentage change compared to previous month (0 if no previous data) |
| `averageMonthlyExpense` | number | Average expense over the last 3 months including the selected month |
| `averageChangePercentage` | number | Percentage change of current 3-month average vs. previous 3-month average |
| `highestExpense` | object | The highest single expense in the month |
| `highestExpense.amount` | number | Amount of the highest expense |
| `highestExpense.category` | string | Category of the highest expense |
| `highestExpense.date` | Date | Date of the highest expense |
| `totalTransactions` | number | Count of expense documents in the selected month |

### Monthly Trend Array

Last 6 months of data ordered chronologically. Each object contains:

| Field | Type | Description |
|-------|------|-------------|
| `month` | string | Month in `YYYY-MM` format |
| `expense` | number | Total expenses for that month |
| `transactions` | number | Number of expense transactions in that month |

### Category Breakdown Array

Expenses grouped by category for the selected month, sorted by amount descending:

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | Expense category name |
| `amount` | number | Total amount for this category in the selected month |
| `percentage` | number | Percentage of total expenses for this category |

---

## Example Usage

### Request
```bash
curl -X GET "http://localhost:5000/api/expenses/dashboard?month=2026-07" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Response
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
        "amount": 450.00,
        "category": "groceries",
        "date": "2026-07-15T00:00:00.000Z"
      },
      "totalTransactions": 42
    },
    "monthlyTrend": [
      {
        "month": "2026-02",
        "expense": 2100.00,
        "transactions": 38
      },
      {
        "month": "2026-03",
        "expense": 2450.00,
        "transactions": 45
      },
      {
        "month": "2026-04",
        "expense": 2250.00,
        "transactions": 40
      },
      {
        "month": "2026-05",
        "expense": 2350.00,
        "transactions": 41
      },
      {
        "month": "2026-06",
        "expense": 2200.00,
        "transactions": 39
      },
      {
        "month": "2026-07",
        "expense": 2500.50,
        "transactions": 42
      }
    ],
    "categoryBreakdown": [
      {
        "category": "groceries",
        "amount": 850.00,
        "percentage": 34
      },
      {
        "category": "utilities",
        "amount": 450.50,
        "percentage": 18
      },
      {
        "category": "transportation",
        "amount": 600.00,
        "percentage": 24
      },
      {
        "category": "entertainment",
        "amount": 300.00,
        "percentage": 12
      },
      {
        "category": "healthcare",
        "amount": 300.00,
        "percentage": 12
      }
    ]
  }
}
```

---

## Error Responses

### 400 Bad Request
Invalid month format
```json
{
  "success": false,
  "message": "Invalid month format. Use YYYY-MM"
}
```

### 401 Unauthorized
Missing or invalid authentication token
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 403 Forbidden
Family ID not associated with user
```json
{
  "success": false,
  "message": "Family ID is required"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch expense dashboard"
}
```

---

## Implementation Details

### Architecture
- **Controller:** `src/controllers/dashboard.controller.js` - `getExpenseDashboard` method
- **Route:** `src/routes/expense.routes.js` - `GET /expenses/dashboard`
- **Middleware:** Uses `auth.middleware` for authentication and `month.middleware` for date parsing
- **Database:** Uses MongoDB aggregation pipelines for efficient data aggregation

### Key Features
✅ Filters by authenticated user's family ID
✅ Uses MongoDB aggregation pipelines for optimal performance
✅ Calculates month-over-month percentage changes
✅ Averages expenses over configurable periods (3 months)
✅ Returns 0 instead of null for missing data
✅ Provides last 6 months of trend data
✅ Groups expenses by category with percentage calculations
✅ Identifies highest single expense in the month

### Data Security
- Requires JWT authentication
- Filters all queries by `familyId` from authenticated user
- Returns only data belonging to the user's family

### Performance Optimizations
- Uses MongoDB `$aggregate` pipeline instead of fetching and processing in application
- Uses indexes on `familyId` and `date` fields in Expense model
- Uses `lean()` where applicable for read-only queries
- Minimal memory footprint for large datasets

---

## Testing

A test script is provided at `test/expenseDashboardTest.js`:

```bash
# Run with a valid JWT token
TEST_AUTH_TOKEN="your-jwt-token" node test/expenseDashboardTest.js
```

The test script validates:
- ✅ Current month dashboard retrieval
- ✅ Specific month retrieval
- ✅ Invalid month format rejection
- ✅ Authentication requirement
- ✅ Response structure and calculations

---

## Notes

- All dates are in UTC timezone
- If previous month has no data, `expenseChangePercentage` is 0 (no increase/decrease)
- If current month has no previous 3-month data, `averageChangePercentage` is 0
- Categories are returned in lowercase as stored in the database
- Percentages are rounded to 2 decimal places
- The endpoint is NOT affected by changes to the regular `/api/expenses` endpoint

---

## Relationship with Other Endpoints

| Endpoint | Purpose | Filters |
|----------|---------|---------|
| `GET /api/expenses` | Get all expense transactions | Month (defaults to current) |
| **`GET /api/expenses/dashboard`** | **Get expense analytics & aggregates** | **Month (required parameter)** |
| `GET /api/dashboard/summary` | Get overall financial summary | All data |
| `GET /api/dashboard/recent` | Get recent transactions | Month (optional) |

The dashboard endpoint is specifically designed for analytics and does NOT return transaction details like the `/api/expenses` endpoint.
