# Transaction Ledger Schema

## MongoDB Schema Changes

### Before
```javascript
{
  itemId: "12345",
  userId: "user-1",
  listing: {
    title: "Item Title",
    pictureURL: "https://...",
    listedTime: Date
  },
  sold: {
    soldPrice: 50.00,
    soldTime: Date,
    feePrice: 5.00,
    shippingLabelCost: 2.00,
    addFeeGeneral: 0,
    finalShippingCost: 6.00
  }
}
```

### After
```javascript
{
  itemId: "12345",
  userId: "user-1",
  listing: {
    title: "Item Title",
    pictureURL: "https://...",
    listedTime: Date
  },
  sold: {
    soldPrice: 50.00,
    soldTime: Date,
    feePrice: 5.00,
    shippingLabelCost: 2.00,
    addFeeGeneral: 0,
    finalShippingCost: 6.00,
    
    // NEW: Complete Financial Transaction Ledger
    transactionLedger: {
      transactions: [
        {
          orderId: "12-34567-89101",
          transactionType: "SALE",
          transactionDate: Date("2026-02-02"),
          description: "Order Sale",
          amount: 50.00,
          bookingEntry: "CREDIT",
          feeType: undefined
        },
        {
          orderId: "12-34567-89101",
          transactionType: "NON_SALE_CHARGE",
          transactionDate: Date("2026-02-02"),
          description: "FINAL_VALUE_FEE Fee",
          amount: -5.00,
          bookingEntry: "DEBIT",
          feeType: "FINAL_VALUE_FEE"
        },
        {
          orderId: "12-34567-89101",
          transactionType: "SHIPPING_LABEL",
          transactionDate: Date("2026-02-02"),
          description: "Shipping Label",
          amount: -2.00,
          bookingEntry: "DEBIT",
          feeType: undefined
        }
      ],
      
      // Aggregated totals for quick access
      totalSaleAmount: 50.00,
      totalRefunds: 0.00,
      totalFees: -5.00,
      totalShippingLabels: -2.00,
      totalBuyerShipping: 0.00,
      
      // TRUE PROFIT/LOSS
      netAmount: 43.00
    }
  }
}
```

## TypeScript Schema

### TransactionRecord
```typescript
interface TransactionRecord {
  orderId?: string;              // eBay Order ID (e.g., "12-34567-89101")
  transactionType: string;       // Type of transaction
  transactionDate: Date;         // When the transaction occurred
  description: string;           // Human-readable description
  amount: number;                // Signed amount (positive/negative)
  bookingEntry: string;          // "DEBIT" or "CREDIT"
  feeType?: string;              // Fee type (e.g., "FINAL_VALUE_FEE", "RETURN_LABEL_CHARGE")
}
```

### TransactionLedger
```typescript
interface TransactionLedger {
  transactions: TransactionRecord[];
  totalSaleAmount?: number;      // Sum of all SALE transactions
  totalRefunds?: number;         // Sum of all REFUND transactions (negative)
  totalFees?: number;            // Sum of all fee transactions
  totalShippingLabels?: number;  // Sum of shipping label costs
  totalBuyerShipping?: number;   // Buyer paid shipping (positive)
  netAmount?: number;            // Final profit/loss calculation
}
```

### MetaDataModel Update
```typescript
type MetaDataModel = {
  // ... existing fields ...
  transactionLedger?: TransactionLedger;  // NEW
  // ... other fields ...
}
```

## Transaction Types Reference

| Type | Description | Typical Sign | Booking Entry |
|------|-------------|--------------|---------------|
| SALE | Order payment from buyer | Positive | CREDIT |
| REFUND | Refund to buyer | Negative | DEBIT |
| SHIPPING_LABEL | Shipping label purchase | Negative | DEBIT |
| NON_SALE_CHARGE | Fees and charges | Negative | DEBIT |
| CREDIT | Fee credits (refunds, adjustments) | Positive | CREDIT |
| ADJUSTMENT | Account adjustments | Variable | DEBIT or CREDIT |

## Fee Types Reference

| Fee Type | Description |
|----------|-------------|
| FINAL_VALUE_FEE | eBay's percentage-based selling fee |
| INTERNATIONAL_FEE | International transaction fee |
| AD_FEE | Advertising/promotion fee |
| RETURN_LABEL_CHARGE | Cost of return shipping label |
| PAYMENT_PROCESSING_FEE | Payment processing fee |

## Example: Refunded Order with Return

### Scenario
- Item listed and sold for $50
- Buyer paid $8 shipping
- eBay charged 10% Final Value Fee ($5)
- Buyer purchased shipping label for $2
- Order then refunded
- Return label cost $7
- eBay credited back the $5 FVF

### Transaction Ledger
```
Transaction 1: SALE ($50.00)
  Buyer pays for item

Transaction 2: NON_SALE_CHARGE - FINAL_VALUE_FEE (-$5.00)
  eBay charges selling fee

Transaction 3: SHIPPING_LABEL (-$2.00)
  Seller purchases shipping label

Transaction 4: REFUND (-$50.00)
  Buyer initiates refund

Transaction 5: NON_SALE_CHARGE - RETURN_LABEL_CHARGE (-$7.00)
  Seller purchases return label

Transaction 6: CREDIT ($5.00)
  eBay credits back the FVF due to refund
```

### Financial Summary
```
Totals:
  Sale Amount:         +$50.00
  Buyer Shipping:      +$8.00
  Fees:                -$5.00 (FVF) + $5.00 (credit) = $0.00
  Shipping Labels:     -$2.00 - $7.00 = -$9.00
  Refunds:             -$50.00

Net Profit/Loss:       -$1.00
```

## Comparison: Old vs. New Calculation

### Old Calculation
```
Sold Price:        $50.00
- eBay Fee:        $5.00
- Shipping Label:  $2.00
= Profit:          $43.00

❌ INCORRECT: Ignores refund, return shipping, fee credit, and buyer shipping
```

### New Calculation (via Transaction Ledger)
```
Sale:              +$50.00
Buyer Shipping:    +$8.00
FVF Fee:           -$5.00
Shipping Label:    -$2.00
Refund:            -$50.00
Return Label:      -$7.00
FVF Credit:        +$5.00
________________
Net Amount:        -$1.00

✓ CORRECT: Includes all financial transactions
```

## Storage Pattern

### Finding Items by Net Amount
```typescript
// Find profitable orders
db.collection('ebayitemmetadatas').find({
  "sold.transactionLedger.netAmount": { $gt: 0 }
})

// Find loss-making orders (refunds)
db.collection('ebayitemmetadatas').find({
  "sold.transactionLedger.netAmount": { $lt: 0 }
})
```

### Finding Orders with Refunds
```typescript
// Find any order with a refund
db.collection('ebayitemmetadatas').find({
  "sold.transactionLedger.totalRefunds": { $ne: 0 }
})

// Find full refunds (sale = refund amount)
db.collection('ebayitemmetadatas').find({
  $expr: {
    $eq: [
      "$sold.transactionLedger.totalSaleAmount",
      { $abs: "$sold.transactionLedger.totalRefunds" }
    ]
  }
})
```

## Backward Compatibility

### Old Records (without transactionLedger)
- Existing `sold` fields remain intact and queryable
- Application defaults to old fields if `transactionLedger` is missing
- No data migration required - gradual adoption possible

### Migration Path
1. New orders automatically include `transactionLedger`
2. Existing records without it continue to work
3. Can batch-process historical records if needed

```typescript
// Safe access pattern
const profit = item.sold?.transactionLedger?.netAmount 
  ?? (item.sold?.soldPrice - item.sold?.feePrice - item.sold?.shippingLabelCost);
```
