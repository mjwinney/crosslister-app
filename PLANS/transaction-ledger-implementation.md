# Transaction Ledger Implementation Plan

## Overview
Implement a comprehensive transaction ledger system that accurately tracks all eBay financial transactions including refunds, to calculate true profit instead of relying on incomplete fee/shipping calculations.

## Current Problem
The app calculates profit as:
```
Profit = Sold Price - eBay Fee - Shipping Cost
```

This ignores:
- Buyer shipping amounts
- Return shipping label costs
- Refunds (full or partial)
- Fee credits from refunds
- Other seller charges

## Solution Approach
Build a complete transaction ledger per order using the eBay Finance API (`sell/finances/v1/transaction`) which contains:
- Order payment credits (sale amount)
- Buyer shipping amounts
- Selling fees (Final Value Fees, etc.)
- Shipping label purchases
- Refunds
- Return label fees
- Fee credits from refunds
- Other seller charges

## Example Transaction Ledger
```
OrderId: 12-34567-89101

+ $42.99  Sale
+ $8.00   Buyer Shipping

- $5.17   Final Value Fee
- $6.50   Shipping Label

- $42.99  Refund
- $7.20   Return Label

+ $5.17   Fee Credit

Net: -$5.70
```

## Database Schema Changes

### New Structure in `EbayItemMetadata`
Extend the `sold` sub-structure with a new `transactionLedger` sub-structure:

```
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

### TypeScript Type Updates
Update `MetaDataModel` to include:
```typescript
transactionLedger?: {
  transactions: TransactionRecord[];
  totalSaleAmount?: number;
  totalRefunds?: number;
  totalFees?: number;
  totalShippingLabels?: number;
  totalBuyerShipping?: number;
  netAmount?: number;
};
```

Where `TransactionRecord` is:
```typescript
interface TransactionRecord {
  orderId?: string;
  transactionType: string;
  transactionDate: Date;
  description: string;
  amount: number;
  bookingEntry: string;
  feeType?: string;
}
```

## Implementation Steps

### 1. Update MongoDB Schema (ebay-item-metadata.ts)
- Add `transactionLedger` sub-structure to `sold` object
- Maintain backward compatibility with existing `sold` fields

### 2. Update TypeScript Types (DatabaseUtils.ts)
- Add `TransactionRecord` interface
- Update `MetaDataModel` to include optional `transactionLedger`
- Update type validation and casting functions

### 3. Create Transaction Ledger Builder (ebayUtils.ts)
- Create `buildTransactionLedger()` function that:
  - Takes raw finance transactions from eBay API
  - Categorizes each transaction
  - Calculates line-item amounts
  - Sums into totals
  - Returns structured ledger

### 4. Update Order Sync Logic (ebayUtils.ts)
- Modify `buildOrderMetadata()` to call the new ledger builder
- Store the complete ledger with the order metadata

### 5. Update Database Save Logic (DatabaseUtils.ts)
- Handle the new nested `transactionLedger` structure during updates

### 6. Add Tests (migrate-ebay-items.test.ts)
- Test ledger building with various scenarios:
  - Simple sale with fees
  - Full refund
  - Partial refund
  - Multiple fees and charges
  - Return label costs

## Finance Transaction Types to Handle
- `SALE`: Order amount (positive)
- `REFUND`: Refund amount (negative)
- `SHIPPING_LABEL`: Label purchase cost (negative)
- `NON_SALE_CHARGE`: Fees and charges
- `ADJUSTMENT`: Adjustments
- `CREDIT`: Fee credits from refunds (positive)

## Key Finance API Fields
```javascript
{
  transactionType: string,          // SALE, REFUND, SHIPPING_LABEL, NON_SALE_CHARGE, ADJUSTMENT, CREDIT
  transactionDate: string,          // ISO date
  amount: { value: string },        // Signed amount
  bookingEntry: string,             // DEBIT or CREDIT
  feeType?: string,                 // AD_FEE, FINAL_VALUE_FEE, INTERNATIONAL_FEE, etc.
  orderLineReferenceId?: string,
  orderId: string
}
```

## Backward Compatibility
- Keep existing `sold` fields intact
- `transactionLedger` is optional
- Existing queries/reports continue to work
- Can gradually migrate existing records

## Reports/Dashboards
- Display full transaction ledger per order
- Show net amount instead of calculated profit
- Highlight refunded orders
- Show fee recovery from refunds
