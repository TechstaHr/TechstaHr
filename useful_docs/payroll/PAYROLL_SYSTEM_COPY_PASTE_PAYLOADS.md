# Copy-Paste Ready Postman Payloads

Simply copy these JSON payloads directly into Postman. Replace the IDs with your actual data.

---

## 1️⃣ SET EMPLOYEE RATE (Required First!)

**POST** `/api/v1/billing/rate`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "hourlyRate": 2500,
  "currency": "NGN",
  "rateType": "hourly",
  "notes": "Initial rate for employee"
}
```

---

## 2️⃣ ADD TAX DEDUCTION (10%)

**POST** `/api/v1/billing/deduction`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Income Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 10,
  "priority": 1,
  "isPreTax": false,
  "isRecurring": true,
  "description": "10% income tax deduction"
}
```

---

## 3️⃣ ADD INSURANCE DEDUCTION (Fixed NGN 5,000)

**POST** `/api/v1/billing/deduction`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Health Insurance",
  "deductionType": "health_insurance",
  "calculationType": "fixed_amount",
  "value": 5000,
  "priority": 2,
  "isPreTax": false,
  "isRecurring": true,
  "description": "Monthly health insurance premium"
}
```

---

## 4️⃣ ADD PENSION DEDUCTION (8% Pre-Tax)

**POST** `/api/v1/billing/deduction`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Pension Contribution",
  "deductionType": "pension",
  "calculationType": "percentage",
  "value": 8,
  "priority": 0,
  "isPreTax": true,
  "isRecurring": true,
  "description": "8% pension contribution (applied before tax)"
}
```

---

## 5️⃣ ADD LOAN REPAYMENT (NGN 10k/month until 50k paid)

**POST** `/api/v1/billing/deduction`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Salary Advance Repayment",
  "deductionType": "loan_repayment",
  "calculationType": "fixed_amount",
  "value": 10000,
  "priority": 5,
  "isPreTax": false,
  "isRecurring": false,
  "targetAmount": 50000,
  "description": "Repaying 50,000 salary advance in 5 installments"
}
```

---

## 6️⃣ ADD CUSTOM DEDUCTION (Union Dues)

**POST** `/api/v1/billing/deduction`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Union Dues",
  "deductionType": "custom",
  "calculationType": "fixed_amount",
  "value": 2500,
  "priority": 10,
  "isPreTax": false,
  "isRecurring": true,
  "description": "Monthly union membership dues"
}
```

---

## 7️⃣ CREATE PAYROLL (Auto-Calculates Everything!)

**POST** `/api/v1/billing/payroll`

```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "bankId": "69333352cbc1955b402b7ee1",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-13",
  "paymentDue": "2025-12-15",
  "paymentGateway": "flutterwave",
  "narration": "December 1-13 Payroll"
}
```

**Monthly Payroll:**
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "bankId": "69333352cbc1955b402b7ee1",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-31",
  "paymentDue": "2025-12-31",
  "paymentGateway": "flutterwave",
  "narration": "December 2025 Monthly Salary"
}
```

---

## 📊 VIEW ENDPOINTS (GET Requests)

### Get Employee Rate
**GET** `/api/v1/billing/rate/693396ffc75f48bd67e6c1d5`

### Get Employee Rate with History
**GET** `/api/v1/billing/rate/693396ffc75f48bd67e6c1d5?includeHistory=true`

### Get All Rates (Employer)
**GET** `/api/v1/billing/rates`

### Get Employee Deductions
**GET** `/api/v1/billing/deduction/693396ffc75f48bd67e6c1d5`

### Get All Deductions (Employer)
**GET** `/api/v1/billing/deductions`

---

## ✏️ UPDATE ENDPOINTS

### Update Employee Rate
**PUT** `/api/v1/billing/rate/{RATE_ID}`

```json
{
  "hourlyRate": 3000,
  "notes": "Annual salary increase"
}
```

### Update Deduction Value
**PUT** `/api/v1/billing/deduction/{DEDUCTION_ID}`

```json
{
  "value": 12,
  "description": "Updated from 10% to 12%"
}
```

### Pause Deduction
**PUT** `/api/v1/billing/deduction/{DEDUCTION_ID}`

```json
{
  "status": "paused"
}
```

### Resume Deduction
**PUT** `/api/v1/billing/deduction/{DEDUCTION_ID}`

```json
{
  "status": "active"
}
```

### Delete Deduction
**DELETE** `/api/v1/billing/deduction/{DEDUCTION_ID}`
(No body required)

---

## 🎯 COMPLETE TEST SCENARIOS

### Scenario A: Employee with NO deductions

**Step 1:** Set rate
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "hourlyRate": 2500,
  "currency": "NGN"
}
```

**Step 2:** Create payroll (after employee has worked)
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "bankId": "69333352cbc1955b402b7ee1",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-31"
}
```

**Expected:** If 100 hours → Gross: 250,000 | Net: 250,000

---

### Scenario B: Employee with Tax and Insurance

**Step 1:** Set rate
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "hourlyRate": 3000,
  "currency": "NGN"
}
```

**Step 2:** Add tax (10%)
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Income Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 10,
  "priority": 1,
  "isRecurring": true
}
```

**Step 3:** Add insurance
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Health Insurance",
  "deductionType": "health_insurance",
  "calculationType": "fixed_amount",
  "value": 5000,
  "priority": 2,
  "isRecurring": true
}
```

**Step 4:** Create payroll
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "bankId": "69333352cbc1955b402b7ee1",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-31"
}
```

**Expected:** If 120 hours → Gross: 360,000 | Tax: 36,000 | Ins: 5,000 | Net: 319,000

---

### Scenario C: Employee with Loan Repayment

**Step 1:** Set rate
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "hourlyRate": 2000,
  "currency": "NGN"
}
```

**Step 2:** Add tax
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 7.5,
  "priority": 1,
  "isRecurring": true
}
```

**Step 3:** Add loan (will auto-complete after 5 payrolls)
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Equipment Loan",
  "deductionType": "loan_repayment",
  "calculationType": "fixed_amount",
  "value": 10000,
  "priority": 5,
  "isRecurring": false,
  "targetAmount": 50000
}
```

**Step 4:** Create payroll monthly (5 times)
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "bankId": "69333352cbc1955b402b7ee1",
  "payPeriodStart": "2025-12-01",
  "payPeriodEnd": "2025-12-31"
}
```

**Expected:** 
- Month 1-4: Loan deducts 10k each
- Month 5: Loan deducts 10k, status → 'completed'
- Month 6+: No more loan deduction

---

## 🔍 VARIATIONS TO TEST

### Higher Rate Employee
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "hourlyRate": 5000,
  "currency": "NGN",
  "notes": "Senior developer rate"
}
```

### Project-Specific Rate
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "hourlyRate": 3500,
  "currency": "NGN",
  "projectId": "68d31429ebb9738877aa0070",
  "notes": "Higher rate for special project"
}
```

### Percentage-Based Loan
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Equipment Loan",
  "deductionType": "loan_repayment",
  "calculationType": "percentage",
  "value": 20,
  "priority": 5,
  "isRecurring": false,
  "targetAmount": 100000,
  "description": "20% of salary until 100k repaid"
}
```

### Capped Tax
```json
{
  "userId": "693396ffc75f48bd67e6c1d5",
  "name": "Income Tax",
  "deductionType": "tax",
  "calculationType": "percentage",
  "value": 15,
  "priority": 1,
  "isRecurring": true,
  "maxAmount": 50000,
  "description": "15% tax with 50k monthly cap"
}
```

---

## 💡 REMEMBER TO REPLACE:

- ✏️ `userId`: `"693396ffc75f48bd67e6c1d5"` → Your employee's actual ID
- ✏️ `bankId`: `"69333352cbc1955b402b7ee1"` → Your bank's actual ID  
- ✏️ `projectId`: `"68d31429ebb9738877aa0070"` → Your project's actual ID
- ✏️ `{RATE_ID}`: Get from "Set Employee Rate" response
- ✏️ `{DEDUCTION_ID}`: Get from "Create Deduction" response

---

## 🎯 TESTING CHECKLIST

- [ ] Set employee rate
- [ ] Get employee rate (verify it saved)
- [ ] Add tax deduction
- [ ] Add insurance deduction
- [ ] Get employee deductions (verify they saved)
- [ ] Ensure employee has approved time entries
- [ ] Create payroll (check calculation in response)
- [ ] Verify gross amount = hours × rate
- [ ] Verify deductions applied correctly
- [ ] Verify net amount = gross - deductions
- [ ] Update rate (old becomes inactive)
- [ ] Pause deduction
- [ ] Resume deduction
- [ ] Delete deduction
- [ ] Create payroll with loan (repeat 5x to test completion)
