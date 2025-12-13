# Payroll Management System - Employee Rates & Deductions

This document explains the implementation of the employee rates and deductions system for the payroll management feature.

## Overview

The system allows employers to:
1. Set hourly rates for employees (with rate history tracking)
2. Configure deductions (taxes, insurance, loan repayments, etc.)
3. Automatically calculate payroll based on approved time entries
4. Generate detailed payroll breakdowns showing gross pay, deductions, and net pay

## Database Models

### 1. EmployeeRate Model
**Location:** `models/EmployeeRate.js`

Stores hourly rates for employees with full history tracking.

**Key Fields:**
- `userId` - The employee
- `employerId` - Who set the rate
- `teamId` - Team reference
- `projectId` - Optional project-specific rate
- `hourlyRate` - Rate per hour
- `currency` - Payment currency (default: NGN)
- `rateType` - 'hourly', 'daily', or 'fixed'
- `effectiveFrom` - When rate becomes active
- `effectiveTo` - When rate ends (null for current rate)
- `status` - 'active' or 'inactive'

**Features:**
- Maintains rate history (all past rates are kept as 'inactive')
- Supports project-specific rates
- Auto-deactivates old rates when new ones are set

### 2. Deduction Model
**Location:** `models/Deduction.js`

Manages all types of deductions from employee pay.

**Key Fields:**
- `userId` - The employee
- `employerId` - Who created the deduction
- `name` - Display name (e.g., "Income Tax", "Health Insurance")
- `deductionType` - 'tax', 'health_insurance', 'pension', 'loan_repayment', 'advance_deduction', 'custom'
- `calculationType` - 'percentage' or 'fixed_amount'
- `value` - Percentage (e.g., 10 for 10%) or fixed amount
- `priority` - Application order (lower = earlier)
- `isPreTax` - Whether deduction is before or after tax
- `maxAmount` - Optional cap per pay period
- `isRecurring` - true for ongoing, false for one-time
- `effectiveFrom/To` - Time period
- `status` - 'active', 'paused', or 'completed'
- `totalDeducted` - Running total (for tracking loan repayments)
- `targetAmount` - Total amount for non-recurring deductions

**Features:**
- Supports percentage and fixed amount deductions
- Priority-based application (taxes before loans, etc.)
- Pre-tax and post-tax deductions
- Automatic completion when target amount reached
- Max amount caps per period

### 3. Updated Payroll Model
**Location:** `models/Payroll.js`

Enhanced to store complete payroll calculation breakdown.

**New Fields:**
- `grossAmount` - Total before deductions (hours × rate)
- `totalHours` - Total approved hours
- `hourlyRate` - Rate used (snapshot at time of payroll)
- `currency` - Payment currency
- `deductions` - Array of applied deductions with details
- `totalDeductions` - Sum of all deductions
- `payPeriodStart/End` - Pay period dates
- `timeEntries` - References to included time entries

## API Endpoints

### Employment Routes
**Base Path:** `/api/v1/billing`

All endpoints require authentication. Only admins/employers can access these.

#### Employee Rates

**Set Employee Rate**
```
POST /billing/rate
Body: {
  "userId": "employee_user_id", // e.g 693396ffc75f48bd67e6c1d5
  "hourlyRate": 50,
  "currency": "NGN",
  "rateType": "hourly",
  "projectId": "optional_project_id", [optional]
  "effectiveFrom": "2025-01-01", [optional]
  "notes": "Initial rate"
}
```

**Get Employee Rate**
```
GET /billing/rate/:userId?projectId=xxx&includeHistory=true
```

**Get All Rates (for employer)**
```
GET /billing/rates?status=active
```

**Update Rate**
```
PUT /billing/rate/:rateId
Body: {
  "hourlyRate": 6000,
  "notes": "Rate increase"
}
```

#### Deductions

**Create Deduction**
```
POST /billing/deduction
Body: {
  "userId": "employee_user_id",
  "name": "Income Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 10,
  "priority": 1,
  "isPreTax": false,
  "isRecurring": true,
  "description": "Standard income tax"
}
```

**Example: Loan Repayment**
```
POST /billing/deduction
Body: {
  "userId": "employee_user_id",
  "name": "Salary Advance Repayment",
  "deductionType": "loan_repayment",
  "calculationType": "fixed_amount",
  "value": 5000,
  "priority": 5,
  "isRecurring": false,
  "targetAmount": 50000,
  "description": "Repaying 50k advance"
}
```

**Get Employee Deductions**
```
GET /billing/deduction/:userId?status=active
```

**Get All Deductions (for employer)**
```
GET /billing/deductions?status=active
```

**Update Deduction**
```
PUT /billing/deduction/:deductionId
Body: {
  "value": 15,
  "status": "paused"
}
```

**Delete Deduction**
```
DELETE /billing/deduction/:deductionId
```

### Updated Billing Routes

**Create Payroll**
```
POST /billing/payroll
Body: {
  "userId": "employee_user_id",
  "bankId": "bank_id",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-31",
  "paymentDue": "2025-12-31",
  "paymentGateway": "flutterwave",
  "narration": "December Salary"
}
```

**Response includes:**
```json
{
  "message": "Payroll created successfully",
  "payroll": {
    "grossAmount": 200000,
    "totalHours": 160,
    "hourlyRate": 1250,
    "deductions": [
      {
        "name": "Income Tax",
        "type": "tax",
        "amount": 20000
      },
      {
        "name": "Health Insurance",
        "type": "health_insurance",
        "amount": 5000
      }
    ],
    "totalDeductions": 25000,
    "paymentAmount": 175000,
    "currency": "NGN"
  },
  "summary": {
    "totalHours": 160,
    "hourlyRate": 1250,
    "grossAmount": 200000,
    "totalDeductions": 25000,
    "netAmount": 175000,
    "deductionsApplied": 2
  }
}
```

## Workflow

### 1. Initial Setup (Employer)

**Step 1: Add Employee to Team**
- Use existing `POST /people/invite` or create user

**Step 2: Set Employee Rate**
```javascript
POST /billing/rate
{
  "userId": "67890",
  "hourlyRate": 2500,
  "currency": "NGN",
  "rateType": "hourly"
}
```

**Step 3: Configure Deductions (Optional)**
```javascript
// Add tax deduction
POST /billing/deduction
{
  "userId": "67890",
  "name": "PAYE Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 7.5,
  "priority": 1,
  "isPreTax": false
}

// Add health insurance
POST /billing/deduction
{
  "userId": "67890",
  "name": "Health Insurance",
  "deductionType": "health_insurance",
  "calculationType": "fixed_amount",
  "value": 5000,
  "priority": 2
}
```

### 2. Daily Operations (Employee)

**Clock In**
```javascript
POST /time/clock-in
{
  "projectId": "project_id"
}
```

**Clock Out**
```javascript
POST /time/clock-out
{
  "entryId": "entry_id"
}
```

**Submit Time Entry**
```javascript
POST /time/submit
{
  "entryId": "entry_id"
}
```

### 3. Approval (Employer)

**Approve Time Entries**
```javascript
POST /time/approve
{
  "entryId": "entry_id"
}
```

### 4. Payroll Generation (Employer)

**Create Payroll**
```javascript
POST /billing/payroll
{
  "userId": "67890",
  "bankId": "bank_id",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-31",
  "paymentDue": "2025-12-31"
}
```

**System automatically:**
1. Fetches all approved time entries for the period
2. Calculates total hours
3. Gets active employee rate
4. Calculates gross pay (hours × rate)
5. Applies deductions in priority order
6. Calculates net pay
7. Creates payroll record with full breakdown

### 5. Payment Execution (Employer)

**Trigger Payment**
```javascript
POST /payment/trigger/:payrollId
```

## Calculation Logic

### Gross Pay Calculation
```
grossAmount = totalHours × hourlyRate
```

### Deduction Application

Deductions are applied in this order:

1. **Pre-tax deductions** (sorted by priority)
   - Example: Pension contributions
   
2. **Post-tax deductions** (sorted by priority)
   - Example: Taxes, insurance, loan repayments

```javascript
let runningAmount = grossAmount;

// Apply pre-tax deductions
for (deduction of preTaxDeductions) {
  amount = calculateDeduction(deduction, runningAmount);
  runningAmount -= amount;
}

// Apply post-tax deductions
for (deduction of postTaxDeductions) {
  amount = calculateDeduction(deduction, runningAmount);
  runningAmount -= amount;
}

netAmount = runningAmount;
```

### Deduction Calculation

**Percentage Deduction:**
```
amount = (baseAmount × percentage) / 100
```

**Fixed Amount:**
```
amount = fixedValue
```

**With Caps:**
```
amount = min(calculatedAmount, maxAmount)
```

**Non-recurring (e.g., Loan):**
```
amount = min(calculatedAmount, targetAmount - totalDeducted)
```

## Example Scenarios

### Scenario 1: Simple Hourly Employee

**Setup:**
- Hourly rate: NGN 2,500
- No deductions

**Time worked:** 160 hours in December

**Calculation:**
```
Gross: 160 × 2,500 = NGN 400,000
Deductions: 0
Net Pay: NGN 400,000
```

### Scenario 2: Employee with Tax and Insurance

**Setup:**
- Hourly rate: NGN 3,000
- Income tax: 10% (post-tax, priority 1)
- Health insurance: NGN 5,000 fixed (post-tax, priority 2)

**Time worked:** 150 hours

**Calculation:**
```
Gross: 150 × 3,000 = NGN 450,000
Tax: 450,000 × 10% = NGN 45,000
Running: 450,000 - 45,000 = NGN 405,000
Insurance: NGN 5,000
Net Pay: 405,000 - 5,000 = NGN 400,000

Total Deductions: NGN 50,000
```

### Scenario 3: Employee with Loan Repayment

**Setup:**
- Hourly rate: NGN 2,000
- Tax: 7.5%
- Loan: NGN 10,000/month until NGN 100,000 repaid

**Time worked:** 180 hours
**Previous loan repayments:** NGN 90,000

**Calculation:**
```
Gross: 180 × 2,000 = NGN 360,000
Tax: 360,000 × 7.5% = NGN 27,000
Running: 360,000 - 27,000 = NGN 333,000
Loan: min(10,000, 100,000 - 90,000) = NGN 10,000
Net Pay: 333,000 - 10,000 = NGN 323,000

Total Deductions: NGN 37,000
Loan Status: Completed (100,000 reached)
```

## Migration Notes

### For Existing Data

The system is backward compatible. Old payroll records without the new fields will continue to work.

For new payrolls:
1. Employers must set employee rates first
2. Deductions are optional
3. Without a rate, payroll creation will fail with a clear error message

### Removing Old payRate Field

The unused `payRate` field has been removed from `BillingInfo` model. This field was never used in the codebase.

## Best Practices

### 1. Rate Management
- Set rates when onboarding employees
- Keep rate history by creating new rates instead of editing
- Use project-specific rates for contractors on different projects

### 2. Deduction Management
- Use priority to control order (taxes before other deductions)
- Set `isPreTax` correctly for accurate calculations
- Use `maxAmount` to prevent over-deduction
- Set `targetAmount` for loans to auto-complete when paid off

### 3. Payroll Creation
- Always specify pay period dates
- Review the breakdown before triggering payment
- Keep consistent pay periods (weekly, bi-weekly, monthly)

### 4. Testing
- Test with various deduction combinations
- Verify calculations manually
- Check edge cases (zero hours, multiple deductions, loan completion)

## Troubleshooting

### "No active rate found for this employee"
**Solution:** Create an employee rate using `POST /billing/rate`

### "No approved time entries found"
**Solution:** Ensure time entries are approved using `POST /time/approve`

### Deduction not appearing in payroll
**Check:**
- Deduction status is 'active'
- `effectiveFrom` is before pay period end
- `effectiveTo` is not before pay period start
- For non-recurring: check if `targetAmount` already reached

### Incorrect calculation
**Verify:**
- Deduction priority order
- `isPreTax` setting
- `maxAmount` caps
- Percentage vs fixed amount type

## Security Considerations

- Only admins can set rates and deductions
- Employees can view their own rates and deductions (future feature)
- All rate and deduction changes are logged with timestamps
- Payroll calculations are immutable once created
- Rate snapshots prevent retroactive changes

## Future Enhancements

1. **Employee Self-Service**
   - View own rate and deductions
   - Download payslips

2. **Bulk Operations**
   - Set rates for multiple employees
   - Apply standard deduction templates

3. **Reports**
   - Payroll summary reports
   - Deduction tracking reports
   - Rate change history

4. **Notifications**
   - Alert when loan repayment completes
   - Notify employees of rate changes

5. **Multi-currency Support**
   - Handle different currencies per employee
   - Exchange rate management
