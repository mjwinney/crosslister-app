# Transaction Ledger Implementation

## Overview
Implemented a comprehensive transaction ledger system that accurately tracks all eBay financial transactions including refunds, to calculate true profit instead of relying on incomplete fee/shipping calculations.

## Problem Solved
Previously, the app calculated profit as:
```
Profit = Sold Price - eBay Fee - Shipping Cost
```

This ignored:
- Buyer shipping amounts
- Return shipping label costs
- Refunds (full or partial)
- Fee credits from refunds
- Other seller charges

## Solution Implemented

### 1. Database Schema Changes
Extended the `EbayItemMetadata` MongoDB schema with a new `transactionLedger` sub-structure under `sold`:

```javascript
sold: {
  soldPrice: Number,
  soldTime: Date,
  feePrice: Number,
  shippingLabelCost: Number,
  addFeeGeneral: Number,
  finalShippingCost: Number,
  
  // NEW: Transaction Ledger
  transactionLedger: {
    transactions: [
      {
        orderId: String,              // eBay Order ID
        transactionType: String,      // SALE, REFUND, SHIPPING_LABEL, etc.
        transactionDate: Date,        // When transaction occurred
        description: String,          // Human-readable description
        amount: Number,               // Signed amount (positive/negative)
        bookingEntry: String,         // DEBIT, CREDIT
        feeType?: String              // AD_FEE, FINAL_VALUE_FEE, etc.
      }
    ],
    totalSaleAmount: Number,          // Sum of SALE transactions
    totalRefunds: Number,             // Sum of REFUND transactions (negative)
    totalFees: Number,                // Sum of all fee transactions (negative)
    totalShippingLabels: Number,      // Sum of SHIPPING_LABEL costs (negative)
    totalBuyerShipping: Number,       // Buyer paid shipping (positive)
    netAmount: Number                 // Final profit/loss for the order
  }
}
```

### 2. TypeScript Types
Added new interfaces in `DatabaseUtils.ts`:

```typescript
export interface TransactionRecord {
  orderId?: string;
  transactionType: string;
  transactionDate: Date;
  description: string;
  amount: number;
  bookingEntry: string;
  feeType?: string;
}

export interface TransactionLedger {
  transactions: TransactionRecord[];
  totalSaleAmount?: number;
  totalRefunds?: number;
  totalFees?: number;
  totalShippingLabels?: number;
  totalBuyerShipping?: number;
  netAmount?: number;
}
```

Updated `MetaDataModel` to include optional `transactionLedger` field.

### 3. Transaction Ledger Builder
Created `buildTransactionLedger()` function in `ebayUtils.ts` that:
- Takes raw finance transactions from eBay Finance API
- Categorizes each transaction by type
- Calculates line-item amounts with proper signs
- Sums into category totals
- Returns structured ledger with net profit/loss

#### Transaction Type Categorization
- **SALE**: Order amount (positive)
- **REFUND**: Refund amount (negative)
- **SHIPPING_LABEL**: Label purchase cost (negative)
- **NON_SALE_CHARGE**: Fees and charges (negative) or return label charges (treated as shipping labels)
- **ADJUSTMENT**: Adjustments (positive or negative)
- **CREDIT**: Fee credits from refunds (positive)

### 4. Integration Points

#### `buildOrderMetadata()` 
Updated to call `buildTransactionLedger()` and include the ledger in metadata.

#### `getMyEbayOrdersDates()`
Updated to build and store transaction ledger when processing order finance data.

#### `updateEbayMetadata()`
Enhanced to properly handle the nested `transactionLedger` object during database saves.

### 5. Data Preservation
- Existing `sold` fields are preserved (`soldPrice`, `feePrice`, `shippingLabelCost`, etc.)
- `transactionLedger` is optional and doesn't affect legacy data
- Backward compatible - existing queries and reports continue to work

## Example Transaction Ledger

```javascript
Order ID: 12-34567-89101

Transactions:
1. SALE: +$42.99 (2026-02-02)
2. FINAL_VALUE_FEE: -$5.17 (2026-02-02)
3. SHIPPING_LABEL: -$6.50 (2026-02-02)
4. REFUND: -$42.99 (2026-02-10)
5. RETURN_LABEL_CHARGE: -$7.20 (2026-02-10)
6. FEE_CREDIT: +$5.17 (2026-02-10)

Totals:
- totalSaleAmount: $42.99
- totalRefunds: -$42.99
- totalFees: $0.00 (FVF -$5.17 + credit +$5.17)
- totalShippingLabels: -$13.70 (label $6.50 + return $7.20)
- totalBuyerShipping: $0.00
- netAmount: -$13.70
```

## Testing
Comprehensive tests added in `migrate-ebay-items.test.ts`:

1. **Builds a ledger from a simple sale with fees** - Tests basic SALE and fee transactions
2. **Builds a ledger from a refunded order** - Tests full refund with return label charge and fee credit
3. **Handles a partial refund with selective fee credit** - Tests partial refund scenarios
4. **Handles shipping labels correctly** - Tests SHIPPING_LABEL categorization
5. **Returns undefined for empty transactions** - Tests edge case handling
6. **Returns undefined for empty transaction array** - Tests edge case handling
7. **Embeds transaction ledger in order metadata** - Integration test with database storage

All 22 tests pass, including 7 new transaction ledger tests.

## Finance API Transaction Types
The implementation handles the following transaction types from eBay's `sell/finances/v1/transaction` API:

```javascript
{
  transactionType: string,          // SALE, REFUND, SHIPPING_LABEL, NON_SALE_CHARGE, ADJUSTMENT, CREDIT
  transactionDate: string,          // ISO date
  amount: { value: string },        // Signed amount
  bookingEntry: string,             // DEBIT or CREDIT
  feeType?: string,                 // AD_FEE, FINAL_VALUE_FEE, INTERNATIONAL_FEE, RETURN_LABEL_CHARGE, etc.
  orderLineReferenceId?: string,
  orderId: string
}
```

## Impact on Existing Code

### Database Schema (`ebay-item-metadata.ts`)
- Added `transactionLedger` sub-structure to `sold` object
- Maintains backward compatibility

### Type Definitions (`DatabaseUtils.ts`)
- Added `TransactionRecord` and `TransactionLedger` interfaces
- Updated `MetaDataModel` with optional `transactionLedger`
- Updated `soldKeys` array to include 'transactionLedger'
- Enhanced `castEbayField()` to handle complex objects

### eBay Utilities (`ebayUtils.ts`)
- Added exported `buildTransactionLedger()` function
- Added exported `getTransactionDescription()` utility
- Updated `buildOrderMetadata()` to build and include ledger
- Updated `getMyEbayOrdersDates()` to build and store ledger

### Tests (`migrate-ebay-items.test.ts`)
- Added 7 new comprehensive tests for transaction ledger
- All 172 existing + new tests pass

## Usage Example

### Reading a Transaction Ledger
```typescript
const item = await getEbayMetadata(userId, itemId);
if (item.ok && item.data.transactionLedger) {
  console.log(`Net profit/loss: $${item.data.transactionLedger.netAmount}`);
  console.log(`Total fees: $${item.data.transactionLedger.totalFees}`);
  console.log(`Total refunds: $${item.data.transactionLedger.totalRefunds}`);
  
  // Iterate through individual transactions
  for (const txn of item.data.transactionLedger.transactions) {
    console.log(`${txn.transactionType}: $${txn.amount} - ${txn.description}`);
  }
}
```

### Building a Ledger Programmatically
```typescript
const financeTransactions = await getTransactions(locals, orderId);
if ('data' in financeTransactions && financeTransactions.status === 200) {
  const ledger = buildTransactionLedger(financeTransactions.data.transactions, orderId);
  console.log(`Order net: $${ledger?.netAmount}`);
}
```

## Future Enhancements
1. Display complete transaction ledger in dashboard/reports
2. Add filters by transaction type in reports
3. Add transaction ledger export/download
4. Create financial reconciliation reports
5. Add alerts for significant refunds or unexpected fees
6. Integrate with tax reporting system

## Backward Compatibility
- Existing `sold` fields remain unchanged and continue to function
- `transactionLedger` is optional - old records without it work fine
- Existing queries and reports are unaffected
- New code can opt-in to use `transactionLedger` for accurate financial data
