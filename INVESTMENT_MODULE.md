# Investment Module Documentation

## Overview
Complete Investments backend module for the NestLedger application. Provides comprehensive investment tracking, portfolio analytics, and reminder management.

## Database Schema

### Investment Model
```javascript
{
  _id: ObjectId,
  familyId: ObjectId (ref: Family),
  userId: ObjectId (ref: User),
  investmentName: String,
  category: String (enum),
  amountInvested: Number (min: 0),
  currentValue: Number (min: 0),
  platform: String,
  frequency: String (enum),
  purchaseDate: Date,
  reminderEnabled: Boolean,
  reminderDate: Date,
  notes: String,
  status: String (enum),
  isDeleted: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Enums

#### InvestmentCategory
- Gold
- MutualFund
- SIP
- Stocks
- FD (Fixed Deposit)
- RD (Recurring Deposit)
- PPF (Public Provident Fund)
- EPF (Employee Provident Fund)
- Crypto
- RealEstate
- EmergencyFund
- Others

#### Frequency
- OneTime
- Monthly
- Quarterly
- HalfYearly
- Yearly

#### Status
- ACTIVE
- CLOSED
- PAUSED

## API Endpoints

### CRUD Operations

#### Create Investment
```
POST /api/investments
Authorization: Bearer <token>
Content-Type: application/json

{
  "investmentName": "Reliance MutualFund",
  "category": "MutualFund",
  "amountInvested": 10000,
  "currentValue": 12000,
  "platform": "NSDL",
  "frequency": "Monthly",
  "purchaseDate": "2024-01-15T00:00:00Z",
  "reminderEnabled": true,
  "reminderDate": "2024-02-15T08:00:00Z",
  "notes": "SIP investment",
  "status": "ACTIVE"
}

Response:
{
  "message": "Investment created successfully",
  "investment": { ...investment object }
}
```

#### Get All Investments (Paginated)
```
GET /api/investments?page=1&limit=10&search=Reliance&category=MutualFund&status=ACTIVE&frequency=Monthly&sortBy=createdAt&order=desc
Authorization: Bearer <token>

Response:
{
  "message": "Investments fetched successfully",
  "investments": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

**Query Parameters:**
- `page` (default: 1) - Page number for pagination
- `limit` (default: 10) - Items per page
- `search` - Search by name, notes, or platform
- `category` - Filter by investment category
- `status` - Filter by status (ACTIVE, CLOSED, PAUSED)
- `frequency` - Filter by frequency
- `sortBy` - Sort field (default: createdAt)
- `order` - Sort order (asc/desc, default: desc)

#### Get Investment Details
```
GET /api/investments/:id
Authorization: Bearer <token>

Response:
{
  "message": "Investment fetched successfully",
  "investment": { ...investment object }
}
```

#### Update Investment
```
PUT /api/investments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "investmentName": "Updated Name",
  "currentValue": 15000,
  "status": "ACTIVE"
}

Response:
{
  "message": "Investment updated successfully",
  "investment": { ...updated investment object }
}
```

#### Delete Investment (Soft Delete)
```
DELETE /api/investments/:id
Authorization: Bearer <token>

Response:
{
  "message": "Investment deleted successfully"
}
```

### Dashboard APIs

#### Dashboard Metrics
```
GET /api/investments/dashboard
Authorization: Bearer <token>

Response:
{
  "message": "Dashboard metrics fetched successfully",
  "totalInvested": 50000,
  "currentPortfolioValue": 65000,
  "gain": 15000,
  "gainPercentage": 30.00,
  "monthlyInvested": 5000,
  "totalInvestments": 5
}
```

#### Portfolio Allocation by Category
```
GET /api/investments/allocation
Authorization: Bearer <token>

Response:
{
  "message": "Allocation fetched successfully",
  "allocation": [
    {
      "category": "Stocks",
      "amount": 25000,
      "percentage": 38.46
    },
    {
      "category": "MutualFund",
      "amount": 20000,
      "percentage": 30.77
    },
    {
      "category": "Gold",
      "amount": 20000,
      "percentage": 30.77
    }
  ]
}
```

#### Monthly Investment Trend
```
GET /api/investments/monthly-trend?months=12
Authorization: Bearer <token>

Response:
{
  "message": "Monthly trend fetched successfully",
  "trend": [
    {
      "month": "2024-01",
      "amountInvested": 5000
    },
    {
      "month": "2024-02",
      "amountInvested": 7000
    }
  ]
}
```

#### Recent Investments
```
GET /api/investments/recent?limit=10
Authorization: Bearer <token>

Response:
{
  "message": "Recent investments fetched successfully",
  "investments": [
    { ...investment object },
    ...
  ]
}
```

#### Upcoming Reminders
```
GET /api/investments/reminders
Authorization: Bearer <token>

Response:
{
  "message": "Upcoming reminders fetched successfully",
  "reminders": [
    {
      "_id": "...",
      "investmentName": "SIP Investment",
      "reminderDate": "2024-02-15T08:00:00Z",
      "frequency": "Monthly",
      "amountInvested": 5000,
      "currentValue": 5500
    }
  ]
}
```

#### Statistics
```
GET /api/investments/statistics
Authorization: Bearer <token>

Response:
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
      "BSE": 2,
      "Upstox": 1
    },
    "frequencyCounts": {
      "Monthly": 3,
      "OneTime": 2,
      "Yearly": 1
    },
    "gainLossSummary": {
      "gainCount": 4,
      "lossCount": 1,
      "noChangeCount": 1
    }
  }
}
```

### Special Operations

#### Duplicate Investment
```
POST /api/investments/:id/duplicate
Authorization: Bearer <token>

Response:
{
  "message": "Investment duplicated successfully",
  "investment": {
    ...investment object with new _id,
    "investmentName": "Original Name (Copy)"
  }
}
```

## Business Logic

### Calculations
- **Gain/Loss**: `currentValue - amountInvested`
- **Gain Percentage**: `(currentValue - amountInvested) / amountInvested * 100`
- **Portfolio Value**: Sum of all `currentValue` for ACTIVE investments
- **Total Invested**: Sum of all `amountInvested` for ACTIVE investments

### Authorization Rules
- Only family members can access family investments
- Only creator or owner can update/delete investments
- Soft delete sets `isDeleted: true` (data preserved)

### Reminder Logic
- Daily scheduled job runs at 8:00 AM
- Finds investments with `reminderEnabled: true` and `reminderDate` matching today
- Sends Firebase push notifications to user's registered devices
- Emits socket event for real-time updates

## Files Created

1. **Models**
   - [Investment.js](../models/Investment.js) - Mongoose schema

2. **Services**
   - [investment.service.js](../services/investment.service.js) - Business logic

3. **Controllers**
   - [investment.controller.js](../controllers/investment.controller.js) - API handlers

4. **Routes**
   - [investment.routes.js](../routes/investment.routes.js) - API endpoints

5. **Jobs**
   - [investmentJobs.js](../jobs/investmentJobs.js) - Scheduled tasks

## Integration Points

### Socket Events
- `investment:created` - Emitted when investment is created
- `investment:updated` - Emitted when investment is updated
- `investment:deleted` - Emitted when investment is deleted
- `investment:duplicated` - Emitted when investment is duplicated
- `investment:reminder` - Emitted when reminder is sent

### Server Integration
- Added route import in server.js
- Registered `/api/investments` endpoint
- Started investment scheduled jobs on server startup

## Validation

### Field Requirements
- `investmentName` - Required, string, trimmed
- `category` - Required, must be valid enum value
- `amountInvested` - Required, number, >= 0
- `currentValue` - Required, number, >= 0
- `frequency` - Required, must be valid enum value
- `purchaseDate` - Required, valid date format

### Business Validations
- Amounts cannot be negative
- Valid date formats enforced
- Only active family members can access
- Creator authorization for modifications

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

## Performance Optimizations

### Database Indexes
- `familyId + isDeleted` - For family investment queries
- `userId + isDeleted` - For user-specific queries
- `familyId + category + isDeleted` - For category filtering
- `reminderDate + reminderEnabled + status` - For reminder queries

### Pagination
- Default 10 items per page
- Configurable limit via query parameter
- Offset-based pagination

### Lean Queries
- Used `.lean()` for read-only operations
- Reduces memory footprint for large datasets

## Testing

Example test cases:
1. Create investment with valid data
2. Create investment with invalid category
3. Update investment with valid updates
4. Try to update investment without authorization
5. Delete investment (soft delete)
6. Get paginated investments with search
7. Calculate dashboard metrics correctly
8. Verify allocation percentages sum to 100%
9. Fetch upcoming reminders for today
10. Duplicate investment successfully

## Future Enhancements

1. Investment performance comparison
2. Historical gain/loss tracking
3. Alert threshold setup (e.g., alert when value drops by X%)
4. Batch operations (bulk create/update/delete)
5. Export to CSV/PDF
6. Advanced filtering with date ranges
7. Investment notes history
8. Performance analytics and charts
