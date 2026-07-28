# Investment Module - Quick Start Guide

## Installation

The Investment module has been integrated into the NestLedger application. No additional installation required. The module is automatically initialized on server startup.

## Quick API Reference

### Authentication
All endpoints require Bearer token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Example Requests

#### 1. Create Investment
```bash
curl -X POST http://localhost:5000/api/investments \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentName": "HDFC Mutual Fund",
    "category": "MutualFund",
    "amountInvested": 25000,
    "currentValue": 28000,
    "platform": "NSDL",
    "frequency": "Monthly",
    "purchaseDate": "2024-01-15",
    "reminderEnabled": true,
    "reminderDate": "2024-02-15",
    "notes": "Monthly SIP contribution"
  }'
```

#### 2. Get All Investments
```bash
curl -X GET "http://localhost:5000/api/investments?page=1&limit=10" \
  -H "Authorization: Bearer your_token"
```

#### 3. Get Investment with Filters
```bash
curl -X GET "http://localhost:5000/api/investments?category=Stocks&status=ACTIVE&sortBy=createdAt&order=desc" \
  -H "Authorization: Bearer your_token"
```

#### 4. Get Investment by ID
```bash
curl -X GET http://localhost:5000/api/investments/investment_id \
  -H "Authorization: Bearer your_token"
```

#### 5. Update Investment
```bash
curl -X PUT http://localhost:5000/api/investments/investment_id \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "currentValue": 32000,
    "notes": "Updated current value"
  }'
```

#### 6. Delete Investment
```bash
curl -X DELETE http://localhost:5000/api/investments/investment_id \
  -H "Authorization: Bearer your_token"
```

#### 7. Get Dashboard Metrics
```bash
curl -X GET http://localhost:5000/api/investments/dashboard \
  -H "Authorization: Bearer your_token"
```

Example response:
```json
{
  "message": "Dashboard metrics fetched successfully",
  "totalInvested": 100000,
  "currentPortfolioValue": 125000,
  "gain": 25000,
  "gainPercentage": 25.00,
  "monthlyInvested": 10000,
  "totalInvestments": 5
}
```

#### 8. Get Portfolio Allocation
```bash
curl -X GET http://localhost:5000/api/investments/allocation \
  -H "Authorization: Bearer your_token"
```

Example response:
```json
{
  "message": "Allocation fetched successfully",
  "allocation": [
    {
      "category": "Stocks",
      "amount": 50000,
      "percentage": 40.0
    },
    {
      "category": "MutualFund",
      "amount": 45000,
      "percentage": 36.0
    },
    {
      "category": "Gold",
      "amount": 30000,
      "percentage": 24.0
    }
  ]
}
```

#### 9. Get Monthly Trend
```bash
curl -X GET "http://localhost:5000/api/investments/monthly-trend?months=12" \
  -H "Authorization: Bearer your_token"
```

#### 10. Get Recent Investments
```bash
curl -X GET "http://localhost:5000/api/investments/recent?limit=10" \
  -H "Authorization: Bearer your_token"
```

#### 11. Get Upcoming Reminders
```bash
curl -X GET http://localhost:5000/api/investments/reminders \
  -H "Authorization: Bearer your_token"
```

#### 12. Get Statistics
```bash
curl -X GET http://localhost:5000/api/investments/statistics \
  -H "Authorization: Bearer your_token"
```

Example response:
```json
{
  "message": "Statistics fetched successfully",
  "statistics": {
    "categoryCounts": {
      "Stocks": 2,
      "MutualFund": 3,
      "Gold": 1
    },
    "platformCounts": {
      "NSDL": 3,
      "BSE": 2
    },
    "frequencyCounts": {
      "Monthly": 3,
      "OneTime": 2
    },
    "gainLossSummary": {
      "gainCount": 4,
      "lossCount": 1,
      "noChangeCount": 1
    }
  }
}
```

#### 13. Duplicate Investment
```bash
curl -X POST http://localhost:5000/api/investments/investment_id/duplicate \
  -H "Authorization: Bearer your_token"
```

## Valid Enum Values

### Investment Categories
```
Gold
MutualFund
SIP
Stocks
FD
RD
PPF
EPF
Crypto
RealEstate
EmergencyFund
Others
```

### Frequency
```
OneTime
Monthly
Quarterly
HalfYearly
Yearly
```

### Status
```
ACTIVE
CLOSED
PAUSED
```

## Response Format

All successful responses follow this format:
```json
{
  "message": "Success message",
  "data": {}
}
```

All error responses follow this format:
```json
{
  "message": "Error message"
}
```

## Features

✅ Create, Read, Update, Delete investments
✅ Soft delete (data preserved)
✅ Pagination with configurable limits
✅ Search by name, notes, platform
✅ Filter by category, status, frequency
✅ Sort by any field (ascending/descending)
✅ Portfolio metrics (gain, gain%, value)
✅ Category-wise allocation breakdown
✅ Monthly investment trends
✅ Recent investments list
✅ Upcoming reminders
✅ Investment statistics
✅ Duplicate investments
✅ Daily reminder notifications
✅ Real-time socket events
✅ Authorization & authentication
✅ Family-level access control

## Important Notes

1. **Soft Delete**: Deleted investments are marked as deleted, not permanently removed
2. **Authorization**: Only family members can access family investments
3. **Creator Access**: Only the user who created an investment can update/delete it
4. **Reminders**: Scheduled to run daily at 8:00 AM (configurable in investmentJobs.js)
5. **Calculations**: Dashboard values are computed from database in real-time
6. **Socket Events**: Real-time updates are pushed via socket.io to all family members

## Troubleshooting

### 401 Unauthorized
- Ensure token is valid and not expired
- Check Authorization header format: `Bearer <token>`

### 404 Not Found
- Verify investment ID exists and belongs to your family
- Check if investment was soft deleted

### 400 Bad Request
- Validate all required fields are provided
- Ensure amounts are non-negative
- Use valid enum values for category, status, frequency

### 500 Server Error
- Check server logs for details
- Ensure MongoDB connection is active
- Verify Firebase Admin SDK is configured

## Socket Events

Subscribe to these events for real-time updates:

```javascript
socket.on('investment:created', (data) => {
  console.log('New investment:', data.investment);
});

socket.on('investment:updated', (data) => {
  console.log('Investment updated:', data.investment);
});

socket.on('investment:deleted', (data) => {
  console.log('Investment deleted:', data.investmentId);
});

socket.on('investment:reminder', (data) => {
  console.log('Investment reminder:', data.message);
});
```

## Performance Tips

1. Use pagination for large datasets
2. Filter by status/category to reduce result size
3. Use sortBy parameter to get most relevant results first
4. Cache dashboard metrics on client side with appropriate TTL
5. Use search when possible instead of fetching all and filtering locally
