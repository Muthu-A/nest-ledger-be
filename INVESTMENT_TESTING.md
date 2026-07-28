# Investment Module - API Testing Guide

## Setup

Before testing, ensure you have:
1. Server running: `npm run dev`
2. Valid JWT token from authentication
3. MongoDB connection active
4. Firebase Admin SDK configured

## Complete Test Scenarios

### Test 1: Full CRUD Operations

#### 1.1 Create Multiple Investments
```bash
# Investment 1: Stocks
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "HDFC Bank Stocks",
    "category": "Stocks",
    "amountInvested": 50000,
    "currentValue": 55000,
    "platform": "BSE",
    "frequency": "OneTime",
    "purchaseDate": "2024-01-01T00:00:00Z",
    "reminderEnabled": false,
    "notes": "Long-term holding"
  }'

# Investment 2: Mutual Fund
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "Axis Direct Plan",
    "category": "MutualFund",
    "amountInvested": 30000,
    "currentValue": 32000,
    "platform": "NSDL",
    "frequency": "Monthly",
    "purchaseDate": "2024-01-15T00:00:00Z",
    "reminderEnabled": true,
    "reminderDate": "2024-02-15T08:00:00Z",
    "notes": "Systematic Investment Plan"
  }'

# Investment 3: Gold
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "Sovereign Gold Bond",
    "category": "Gold",
    "amountInvested": 40000,
    "currentValue": 42000,
    "platform": "RBI",
    "frequency": "OneTime",
    "purchaseDate": "2023-12-01T00:00:00Z",
    "reminderEnabled": false,
    "notes": "Safe investment"
  }'

# Investment 4: FD
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "HDFC FD",
    "category": "FD",
    "amountInvested": 25000,
    "currentValue": 26000,
    "platform": "HDFC Bank",
    "frequency": "OneTime",
    "purchaseDate": "2023-11-01T00:00:00Z",
    "reminderEnabled": true,
    "reminderDate": "2024-11-01T10:00:00Z",
    "notes": "5-year fixed deposit"
  }'

# Investment 5: PPF
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "Public Provident Fund",
    "category": "PPF",
    "amountInvested": 150000,
    "currentValue": 165000,
    "platform": "SBI",
    "frequency": "Yearly",
    "purchaseDate": "2023-06-15T00:00:00Z",
    "reminderEnabled": true,
    "reminderDate": "2024-06-15T08:00:00Z",
    "notes": "Long-term tax-free investment"
  }'
```

#### 1.2 Retrieve All Investments
```bash
curl -X GET "http://localhost:5000/api/investments" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Array of 5 investments

#### 1.3 Get Investment by ID
```bash
# Replace investment_id with actual ID from create response
curl -X GET "http://localhost:5000/api/investments/{investment_id}" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Single investment object

#### 1.4 Update Investment
```bash
curl -X PUT "http://localhost:5000/api/investments/{investment_id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentValue": 58000,
    "notes": "Updated valuation after market analysis"
  }'
```

Expected: Updated investment object

#### 1.5 Delete Investment
```bash
curl -X DELETE "http://localhost:5000/api/investments/{investment_id}" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Success message

---

### Test 2: Search, Filtering, and Pagination

#### 2.1 Search by Name
```bash
curl -X GET "http://localhost:5000/api/investments?search=HDFC" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Investments with HDFC in name

#### 2.2 Filter by Category
```bash
curl -X GET "http://localhost:5000/api/investments?category=MutualFund" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Only mutual fund investments

#### 2.3 Filter by Frequency
```bash
curl -X GET "http://localhost:5000/api/investments?frequency=Monthly" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Only monthly investments

#### 2.4 Filter by Status
```bash
curl -X GET "http://localhost:5000/api/investments?status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Only active investments

#### 2.5 Combined Filters
```bash
curl -X GET "http://localhost:5000/api/investments?category=Stocks&status=ACTIVE&sortBy=createdAt&order=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Active stock investments sorted by creation date

#### 2.6 Pagination
```bash
# Page 1
curl -X GET "http://localhost:5000/api/investments?page=1&limit=2" \
  -H "Authorization: Bearer $TOKEN"

# Page 2
curl -X GET "http://localhost:5000/api/investments?page=2&limit=2" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Paginated results with pagination metadata

---

### Test 3: Dashboard Analytics

#### 3.1 Dashboard Metrics
```bash
curl -X GET "http://localhost:5000/api/investments/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "message": "Dashboard metrics fetched successfully",
  "totalInvested": 295000,
  "currentPortfolioValue": 320000,
  "gain": 25000,
  "gainPercentage": 8.47,
  "monthlyInvested": 30000,
  "totalInvestments": 5
}
```

Verify calculations:
- `gain` = 320000 - 295000 = 25000 ✓
- `gainPercentage` = (25000 / 295000) * 100 = 8.47 ✓

#### 3.2 Portfolio Allocation
```bash
curl -X GET "http://localhost:5000/api/investments/allocation" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "message": "Allocation fetched successfully",
  "allocation": [
    {
      "category": "PPF",
      "amount": 165000,
      "percentage": 51.56
    },
    {
      "category": "Stocks",
      "amount": 55000,
      "percentage": 17.19
    },
    ...
  ]
}
```

Verify: Sum of percentages = 100%

#### 3.3 Monthly Trend
```bash
curl -X GET "http://localhost:5000/api/investments/monthly-trend?months=12" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Month-wise investment amounts

#### 3.4 Recent Investments
```bash
curl -X GET "http://localhost:5000/api/investments/recent?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Last 5 created investments

#### 3.5 Statistics
```bash
curl -X GET "http://localhost:5000/api/investments/statistics" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "message": "Statistics fetched successfully",
  "statistics": {
    "categoryCounts": {
      "Stocks": 1,
      "MutualFund": 1,
      "Gold": 1,
      "FD": 1,
      "PPF": 1
    },
    "platformCounts": {
      "BSE": 1,
      "NSDL": 1,
      "RBI": 1,
      "HDFC Bank": 1,
      "SBI": 1
    },
    "frequencyCounts": {
      "OneTime": 3,
      "Monthly": 1,
      "Yearly": 1
    },
    "gainLossSummary": {
      "gainCount": 5,
      "lossCount": 0,
      "noChangeCount": 0
    }
  }
}
```

#### 3.6 Upcoming Reminders
```bash
curl -X GET "http://localhost:5000/api/investments/reminders" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Investments with reminders due today or in future

---

### Test 4: Special Operations

#### 4.1 Duplicate Investment
```bash
curl -X POST "http://localhost:5000/api/investments/{investment_id}/duplicate" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- New investment with same data
- Investment name: "Original Name (Copy)"
- New ObjectId
- Same userId as original

Verify: New total investment count increased by 1

---

### Test 5: Error Scenarios

#### 5.1 Create with Invalid Category
```bash
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "Test",
    "category": "InvalidCategory",
    "amountInvested": 1000,
    "currentValue": 1000,
    "frequency": "Monthly",
    "purchaseDate": "2024-01-01"
  }'
```

Expected: 400 Bad Request (validation will happen at create time)

#### 5.2 Create with Negative Amount
```bash
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "Test",
    "category": "Stocks",
    "amountInvested": -1000,
    "currentValue": 1000,
    "frequency": "OneTime",
    "purchaseDate": "2024-01-01"
  }'
```

Expected: 400 Bad Request

#### 5.3 Create with Missing Required Fields
```bash
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "Test",
    "category": "Stocks"
  }'
```

Expected: 400 Bad Request - missing fields

#### 5.4 Access Non-existent Investment
```bash
curl -X GET "http://localhost:5000/api/investments/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: 404 Not Found

#### 5.5 Unauthorized Access (Invalid Token)
```bash
curl -X GET "http://localhost:5000/api/investments" \
  -H "Authorization: Bearer invalid_token"
```

Expected: 401 Unauthorized

---

## Performance Testing

### Test 1: Pagination Performance
```bash
# Get page 1
time curl -X GET "http://localhost:5000/api/investments?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Get page 10
time curl -X GET "http://localhost:5000/api/investments?page=10&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Response time < 500ms

### Test 2: Dashboard Metrics Performance
```bash
time curl -X GET "http://localhost:5000/api/investments/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Response time < 300ms

### Test 3: Search Performance
```bash
time curl -X GET "http://localhost:5000/api/investments?search=test&category=Stocks" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Response time < 500ms

---

## Integration Testing

### Test: Socket Events
Connect to socket and monitor events:

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('investment:created', (data) => {
  console.log('Investment created:', data);
});

socket.on('investment:updated', (data) => {
  console.log('Investment updated:', data);
});

socket.on('investment:deleted', (data) => {
  console.log('Investment deleted:', data);
});

// Then create/update/delete investments and verify socket events
```

---

## Troubleshooting Test Issues

### Issue: 401 Unauthorized on all requests
**Solution**: Ensure token is valid and fresh. Re-authenticate if needed.

### Issue: 404 on investment by ID
**Solution**: Verify ID is correct and hasn't been deleted. Check family membership.

### Issue: Dashboard shows 0 values
**Solution**: Ensure investments are marked as ACTIVE status. Check familyId matches.

### Issue: Pagination returns empty array on page 2+
**Solution**: Check total count matches expected. May not have enough records.

### Issue: Search returns no results
**Solution**: Ensure search term matches case-insensitive. Try broader search.

---

## Success Criteria Checklist

- [ ] All 5 investments created successfully
- [ ] CRUD operations work (Create, Read, Update, Delete)
- [ ] Search and filters return correct results
- [ ] Pagination works correctly
- [ ] Dashboard calculations are accurate
- [ ] Allocation percentages sum to 100%
- [ ] Statistics counts are correct
- [ ] Duplicate operation creates new investment
- [ ] Error scenarios return appropriate status codes
- [ ] Socket events are emitted
- [ ] Authorization prevents unauthorized access
- [ ] Soft delete preserves data
