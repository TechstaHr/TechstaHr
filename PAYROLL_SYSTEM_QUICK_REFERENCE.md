# Postman Testing Quick Reference

## Before You Start

1. **Login as Admin** to get your auth token
2. **Replace these IDs** in the payloads with your actual data:
   - `userId`: Employee user ID (e.g., from your database)
   - `bankId`: Bank ID from your banks collection
   - `projectId`: Project ID (if using project-specific rates)

---

## Quick Test Sequence

### ✅ STEP 1: Set Employee Rate (REQUIRED)

**Endpoint:** `POST /api/v1/billing/rate`

```json
{
  "userId": "YOUR_EMPLOYEE_ID",
  "hourlyRate": 2500,
  "currency": "NGN",
  "rateType": "hourly",
  "notes": "Initial rate"
}
```

---

### ✅ STEP 2: Add Tax Deduction (OPTIONAL)

**Endpoint:** `POST /api/v1/billing/deduction`

```json
{
  "userId": "YOUR_EMPLOYEE_ID",
  "name": "Income Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 10,
  "priority": 1,
  "isPreTax": false,
  "isRecurring": true,
  "description": "10% income tax"
}
```

---

### ✅ STEP 3: Add Insurance Deduction (OPTIONAL)

**Endpoint:** `POST /api/v1/billing/deduction`

```json
{
  "userId": "YOUR_EMPLOYEE_ID",
  "name": "Health Insurance",
  "deductionType": "health_insurance",
  "calculationType": "fixed_amount",
  "value": 5000,
  "priority": 2,
  "isRecurring": true,
  "description": "Monthly health insurance"
}
```

---

### ✅ STEP 4: Add Loan Deduction (OPTIONAL)

**Endpoint:** `POST /api/v1/billing/deduction`

```json
{
  "userId": "YOUR_EMPLOYEE_ID",
  "name": "Salary Advance",
  "deductionType": "loan_repayment",
  "calculationType": "fixed_amount",
  "value": 10000,
  "priority": 5,
  "isRecurring": false,
  "targetAmount": 50000,
  "description": "50k advance repayment"
}
```

---

### ✅ STEP 5: Create Payroll

**Endpoint:** `POST /api/v1/billing/payroll`

```json
{
  "userId": "YOUR_EMPLOYEE_ID",
  "bankId": "YOUR_BANK_ID",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-13",
  "paymentDue": "2025-12-15",
  "paymentGateway": "flutterwave",
  "narration": "December payroll"
}
```

**Expected Response:**
```json
{
  "message": "Payroll created successfully",
  "payroll": {
    "grossAmount": 200000,
    "totalHours": 80,
    "hourlyRate": 2500,
    "deductions": [...],
    "totalDeductions": 25000,
    "paymentAmount": 175000
  },
  "summary": {
    "totalHours": 80,
    "hourlyRate": 2500,
    "grossAmount": 200000,
    "totalDeductions": 25000,
    "netAmount": 175000,
    "deductionsApplied": 2
  }
}
```

---

## View/Manage Endpoints

### Get Employee Rate
```
GET /api/v1/billing/rate/YOUR_EMPLOYEE_ID
```

### Get All Rates
```
GET /api/v1/billing/rates
```

### Get Employee Deductions
```
GET /api/v1/billing/deduction/YOUR_EMPLOYEE_ID
```

### Get All Deductions
```
GET /api/v1/billing/deductions
```

### Update Rate
```
PUT /api/v1/billing/rate/RATE_ID

{
  "hourlyRate": 3000,
  "notes": "Salary increase"
}
```

### Update Deduction
```
PUT /api/v1/billing/deduction/DEDUCTION_ID

{
  "value": 12,
  "description": "Updated percentage"
}
```

### Pause Deduction
```
PUT /api/v1/billing/deduction/DEDUCTION_ID

{
  "status": "paused"
}
```

### Resume Deduction
```
PUT /api/v1/billing/deduction/DEDUCTION_ID

{
  "status": "active"
}
```

### Delete Deduction
```
DELETE /api/v1/billing/deduction/DEDUCTION_ID
```

---

## Common Test Scenarios

### 🧪 Scenario 1: Simple Employee (No Deductions)
1. Set rate: 2500/hour
2. Create payroll
3. Expected: Gross = Net (no deductions)

### 🧪 Scenario 2: With Tax Only
1. Set rate: 3000/hour
2. Add 10% tax
3. Create payroll for 100 hours
4. Expected: Gross=300k, Tax=30k, Net=270k

### 🧪 Scenario 3: Multiple Deductions
1. Set rate: 2500/hour
2. Add 10% tax (priority 1)
3. Add 5000 insurance (priority 2)
4. Create payroll for 160 hours
5. Expected: Gross=400k, Tax=40k, Insurance=5k, Net=355k

### 🧪 Scenario 4: Loan Completion
1. Set rate: 2000/hour
2. Add loan: 10k/month, target 50k
3. Create 5 monthly payrolls
4. After 5th: Loan status = 'completed'

---

## Common Errors & Fixes

### ❌ "No active rate found for this employee"
**Fix:** Create employee rate first using Step 1

### ❌ "No approved time entries found for this period"
**Fix:** 
- Ensure employee has clocked in/out
- Ensure time entries are submitted
- Ensure admin has approved them
- Check date range matches

### ❌ "Missing required fields"
**Fix:** Include userId, bankId, payPeriodStart, payPeriodEnd

### ❌ "Employee not found"
**Fix:** Use correct employee userId from your database

---

## Calculation Examples

### Example 1: Basic
```
Hours: 100
Rate: 2,500
Deductions: None

Gross = 100 × 2,500 = 250,000
Net = 250,000
```

### Example 2: With Tax
```
Hours: 120
Rate: 3,000
Tax: 10%

Gross = 120 × 3,000 = 360,000
Tax = 360,000 × 0.10 = 36,000
Net = 360,000 - 36,000 = 324,000
```

### Example 3: Multiple Deductions
```
Hours: 160
Rate: 2,500
Tax: 10% (priority 1)
Insurance: 5,000 (priority 2)

Gross = 160 × 2,500 = 400,000
Tax = 400,000 × 0.10 = 40,000
Running = 400,000 - 40,000 = 360,000
Insurance = 5,000
Net = 360,000 - 5,000 = 355,000
```

### Example 4: Pre-tax & Post-tax
```
Hours: 150
Rate: 3,000
Pension: 8% (pre-tax, priority 0)
Tax: 10% (post-tax, priority 1)

Gross = 150 × 3,000 = 450,000
Pension = 450,000 × 0.08 = 36,000 (pre-tax)
Running = 450,000 - 36,000 = 414,000
Tax = 414,000 × 0.10 = 41,400 (post-tax)
Net = 414,000 - 41,400 = 372,600

Total Deductions = 36,000 + 41,400 = 77,400
```

---

## Deduction Types Reference

| Type | Code | Common Use |
|------|------|------------|
| Tax | `tax` | Income tax, PAYE |
| Insurance | `health_insurance` | Health coverage |
| Pension | `pension` | Retirement contribution |
| Loan | `loan_repayment` | Salary advances, equipment loans |
| Advance | `advance_deduction` | One-time advance recovery |
| Custom | `custom` | Union dues, gym, meals |

---

## Calculation Types

| Type | Code | Example |
|------|------|---------|
| Percentage | `percentage` | 10% tax, 5% pension |
| Fixed | `fixed_amount` | 5,000 insurance, 2,500 dues |

---

## Priority Rules

- **Lower number = Higher priority** (applied first)
- Common priorities:
  - 0: Pre-tax deductions (pension)
  - 1: Taxes
  - 2-4: Insurances
  - 5-9: Loans/advances
  - 10+: Custom deductions

---

## Status Values

### Rate Status
- `active` - Current rate
- `inactive` - Old rate (history)

### Deduction Status
- `active` - Currently applied
- `paused` - Temporarily disabled
- `completed` - Finished (loan paid off)

### Payroll Status
- `scheduled` - Created, pending payment
- `initiated` - Payment in progress
- `completed` - Paid successfully
- `failed` - Payment failed

---

## Tips

1. **Always set employee rate first** before creating payroll
2. **Use consistent pay periods** (weekly, bi-weekly, monthly)
3. **Review breakdown** in payroll response before triggering payment
4. **Lower priority numbers run first** for deductions
5. **Pre-tax deductions** reduce taxable amount
6. **Non-recurring deductions** auto-complete when target reached
7. **Keep rate history** - don't delete old rates
8. **Test with small amounts** first

---

## Need Help?

- See `PAYROLL_SYSTEM.md` for complete documentation
- See `PAYROLL_SYSTEM_POSTMAN_PAYLOADS.json` for all payload variations
- See `PAYROLL_SYSTEM_COPY_PASTE_PAYLOADS.md` for json copy/paste samples
