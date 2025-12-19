# Database Migration: Fix Bank ID Unique Constraint

## Problem
The `billinginfos` collection has a unique index on `bankDetail.bankId`, which prevents multiple users from having accounts at the same bank. This causes a duplicate key error when trying to update billing information.

## Solution
1. **Updated BillingInfo Model**: Added an auto-increment `billingId` field as a unique identifier
2. **Removed Unique Constraint**: Changed `bankDetail.bankId` from unique to a regular index
3. **Migration Script**: Created `migrateBillingSchema.js` to update the existing database

## How to Run the Migration

### Step 1: Stop the Server
In the terminal where `pnpm serve` is running, press `Ctrl+C` to stop the server.

### Step 2: Run the Migration
```bash
node migrateBillingSchema.js
```

### Step 3: Restart the Server
```bash
pnpm serve
```

## What the Migration Does

1. ✅ Drops the unique index on `bankDetail.bankId`
2. ✅ Creates a regular (non-unique) index on `bankDetail.bankId` for performance
3. ✅ Adds `billingId` field to existing documents (starting from 1000)
4. ✅ Verifies the changes and shows a summary

## Changes Made

### `models/BillingInfo.js`
- Added `mongoose-sequence` plugin for auto-incrementing `billingId`
- Added `billingId` field (Number, unique, auto-increment starting from 1000)
- Changed `bankDetail.bankId` to have a regular index instead of unique

### `package.json`
- Added `mongoose-sequence` dependency

## After Migration

After running the migration successfully:
- Multiple users can now use the same bank
- Each billing record has a unique `billingId`
- The duplicate key error will no longer occur
- Performance is maintained with a regular index on `bankDetail.bankId`

## Rollback (if needed)

If you need to rollback, you can manually drop the index and recreate it as unique:

```javascript
// In MongoDB shell or Compass
db.billinginfos.dropIndex('bankDetail.bankId_1');
db.billinginfos.createIndex({ 'bankDetail.bankId': 1 }, { unique: true });
```

However, this will only work if there are no duplicate `bankDetail.bankId` values in the collection.
