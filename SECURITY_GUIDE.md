# Security Hardening - Quick Reference

## Critical Changes Overview

### 1. Environment Variables (REQUIRED)
```bash
# .env file MUST include:
JWT_SECRET=your-very-strong-random-secret-here  # REQUIRED - app will not start without it
CLIENT_ORIGIN=http://localhost:5173  # For development
# For production: CLIENT_ORIGIN=https://your-domain.com
```

### 2. IDOR Prevention Pattern
**All financial data (income, expenses, goals, budgets, investments) must filter by `familyId`:**

```javascript
// ❌ WRONG - vulnerable to IDOR
const goal = await Goal.findById(goalId);

// ✅ CORRECT - secure
const goal = await Goal.findOne({ _id: goalId, familyId: req.user.familyId });
```

### 3. Mass Assignment Prevention
**Always whitelist allowed fields in updates:**

```javascript
// ❌ WRONG - allows updating anything
const updated = await Income.findByIdAndUpdate(id, req.body);

// ✅ CORRECT - only allowed fields
const allowedFields = ['amount', 'source', 'date', 'notes'];
const updateData = {};
allowedFields.forEach(field => {
  if (field in req.body) updateData[field] = req.body[field];
});
const updated = await Income.findOneAndUpdate(
  { _id: id, familyId: req.user.familyId },
  updateData
);
```

### 4. Input Validation
**Always validate input types and lengths:**

```javascript
// ❌ WRONG - no validation
const name = req.body.name;

// ✅ CORRECT - validated
const name = validateString(req.body.name, 100); // max 100 chars
if (!name) return res.status(400).json({ error: "Invalid name" });
```

### 5. JWT Handling
**Always check JWT_SECRET is configured:**

```javascript
// ❌ WRONG - fallback to weak secret
jwt.verify(token, process.env.JWT_SECRET || "secret");

// ✅ CORRECT - fail if not configured
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET must be configured");
jwt.verify(token, jwtSecret);
```

---

## Files Protected

### Controllers with IDOR Fixes:
- ✅ `goal.controller.js` - all queries filter by familyId
- ✅ `income.controller.js` - field whitelisting + familyId verification
- ✅ `expense.controller.js` - field whitelisting + familyId verification
- ✅ `budget.controller.js` - all queries filter by familyId
- ✅ `dashboard.controller.js` - aggregations filter by familyId
- ✅ `reminder.controller.js` - field whitelisting
- ✅ `investment.controller.js` - verified filters at service layer

### Authentication & Authorization:
- ✅ `auth.middleware.js` - JWT_SECRET validation
- ✅ `auth.controller.js` - password validation, JWT_SECRET validation
- ✅ `role.middleware.js` - familyId from authenticated user only
- ✅ `socketMiddleware.js` - JWT_SECRET validation

### Server Configuration:
- ✅ `server.js` - CORS, security headers, size limits, error handlers

### Utilities:
- ✅ `validation.js` - input validation helpers

---

## Testing Checklist

Before deploying, verify:

- [ ] `JWT_SECRET` environment variable is set
- [ ] `CLIENT_ORIGIN` is set to production domain
- [ ] All endpoints return 403/404 for unauthorized access
- [ ] IDOR attack attempts fail (changing familyId in requests)
- [ ] Mass assignment fails (trying to update restricted fields)
- [ ] Rate limiting works on auth endpoints
- [ ] Security headers present in responses
- [ ] Error messages don't expose stack traces
- [ ] Password reset requires valid input

---

## Common Pitfalls to Avoid

### ❌ Don't:
- Use `Model.findById()` without familyId verification
- Pass entire `req.body` to `findByIdAndUpdate()`
- Extract `familyId` from `req.body` or `req.params`
- Use `JWT_SECRET || "fallback-secret"`
- Log or return sensitive data in errors
- Allow unlimited request body size
- Skip input type validation

### ✅ Do:
- Filter all queries by `familyId: req.user.familyId`
- Use field whitelisting for updates
- Extract `familyId` only from `req.user`
- Fail at startup if `JWT_SECRET` is missing
- Use generic error messages
- Set request size limits
- Validate input types before use

---

## New Security Utilities

### Using the Validation Module:

```javascript
const {
  isValidObjectId,
  validateString,
  validateEmail,
  validateNumber,
  validateDate,
  filterAllowedFields
} = require("../utils/validation");

// Example usage
const email = validateEmail(req.body.email);
if (!email) return res.status(400).json({ error: "Invalid email" });

const amount = validateNumber(req.body.amount, 0, 1000000);
if (amount === null) return res.status(400).json({ error: "Invalid amount" });

const allowedData = filterAllowedFields(req.body, ['name', 'amount']);
```

---

## Environment Setup

### Development (.env):
```env
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=dev-secret-at-least-32-characters-long
CLIENT_ORIGIN=http://localhost:5173
RESEND_API_KEY=re_...
MAIL_FROM=NestLedger <onboarding@resend.dev>
FRONTEND_URL=http://localhost:5173
```

### Production (.env):
```env
PORT=5000
MONGO_URI=mongodb+srv://... (production db)
JWT_SECRET=generate-strong-random-secret-min-32-chars
CLIENT_ORIGIN=https://your-production-domain.com
RESEND_API_KEY=re_... (production key)
MAIL_FROM=NestLedger <notifications@your-domain.com>
FRONTEND_URL=https://your-production-domain.com
NODE_ENV=production
```

---

## For Code Reviews

When reviewing pull requests, check for:

1. **IDOR**: All queries filter by `familyId`
2. **Mass Assignment**: Field whitelisting in updates
3. **Input Validation**: Type checking before use
4. **JWT Handling**: No hardcoded secrets
5. **Error Handling**: No stack traces or sensitive data
6. **Authorization**: User ownership verified before operations

---

## Support & Questions

For security-related questions or to report issues, document them with:
- Affected endpoint
- Attack scenario
- Expected vs actual behavior
- Steps to reproduce

---

**Last Updated**: August 18, 2026  
**Security Level**: 🔒 HARDENED
