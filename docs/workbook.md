# Workbook reference

The shop owns and shares the Google spreadsheet. Each staff account needs edit access and authorizes the selected file with the `drive.file` scope. Start with a blank workbook; initialization creates managed tabs and leaves unrelated tabs alone.

## Managed tabs

Headers below are exact and ordered left to right. The implementation sources are `HEADERS` in `src/domain/workbook.ts` and header mapping in `src/infrastructure/google/sheets.ts`. Keep IDs stable and unique within their tab; referenced IDs join records across tabs.

| Tab           | Headers in column order                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchase Lots | `ID`, `Name`, `Total Amount`, `Total Units`                                                                                                                                                             |
| Settings      | `ID`, `Value`                                                                                                                                                                                           |
| Categories    | `ID`, `Name`, `Parent Category ID`                                                                                                                                                                      |
| Customers     | `ID`, `Name`, `Contact`, `Address`, `Notes`, `Active`                                                                                                                                                   |
| Products      | `ID`, `Name`, `Category ID`, `Description`, `Option Names`, `Active`, `Image`                                                                                                                           |
| Variants      | `ID`, `Product ID`, `SKU`, `Option Values`, `Price`, `Active`                                                                                                                                           |
| Orders        | `ID`, `Order Number`, `Created At`, `Customer`, `Contact`, `Address`, `Status`, `Payment Status`, `Notes`, `Discount`, `Shipping Charge`, `Customer ID`, `Shipping Option`, `Charges`, `Partial Amount` |
| Order Items   | `ID`, `Order ID`, `Variant ID`, `Product Name`, `Variant Name`, `SKU`, `Quantity`, `Unit Price`                                                                                                         |
| Returns       | `ID`, `Order Item ID`, `Quantity`, `Status`, `Condition`, `Received At`, `Notes`                                                                                                                        |
| Stock Entries | `ID`, `Variant ID`, `Date`, `Type`, `On Hand Change`, `Unavailable Change`, `Notes`, `Purchase Lot ID`                                                                                                  |
| Inventory     | `Variant ID`, `SKU`, `Product`, `Options`, `On Hand`, `Reserved`, `Unavailable`, `Available`                                                                                                            |

Inventory is formula output, not an input ledger. The browser computes its balances from the source records independently. Do not overwrite the formula cells with manual counts.

## Settings

| ID                | Value                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`   | Required value `1`                                                                                                                       |
| `businessName`    | Initially the spreadsheet title                                                                                                          |
| `currency`        | Uppercase three-letter code; initialized as `USD`                                                                                        |
| `shippingOptions` | Optional JSON array of objects with unique nonempty `id`, nonblank `name`, and nonnegative numeric `rate`                                |
| `chargeRates`     | Optional JSON array of charges with a unique `id`, a `name`, a nonnegative numeric `percent`, and a `mode` of `inclusive` or `exclusive` |

For example, a shipping-options Value cell can contain:

```json
[{ "id": "pickup", "name": "Pickup", "rate": 0 }]
```

Prefer the Settings screen for currency and shipping changes. Amounts are stored as numbers without per-row currency; changing currency does not convert them.

## Values and relationships

- Categories reference another category through Parent Category ID. Products reference categories; variants reference products. Category hierarchies cannot contain cycles.
- Orders optionally reference saved customers and retain customer/contact/address snapshots. Order Items reference both orders and variants and retain name/SKU/price snapshots.
- Orders store the rates and rounded amounts applied at creation in the Charges cell. A blank cell means no charges. Percentages share the discounted product subtotal after backing out inclusive charges. Exclusive amounts increase the order total. Shipping is excluded from the calculation.
- Returns reference Order Items. Stock Entries reference variants and optionally Purchase Lots.
- Numeric cells must contain finite numbers. Quantities and stock deltas used by app saves must be whole units. Empty Discount and Shipping Charge cells read as zero.
- Active cells accept Google Sheets boolean `TRUE` or `FALSE`; blank reads as active. Use `FALSE` to archive.
- Order Status: `Draft`, `In progress`, `Shipped`, `Completed`, `Cancelled`. Payment Status: `Unpaid`, `Partially paid`, `Paid`, `Partially refunded`, `Refunded`. Partial Amount holds the cumulative amount collected for Partially paid or returned for Partially refunded.
- Return Status: `Requested`, `Received`. Condition: `Sellable`, `Damaged`; receiving requires a condition and date.
- Stock Type: `Opening stock`, `Receipt`, `Adjustment`, `Damaged`, `Restocked`. Balances use the signed On Hand Change and Unavailable Change values, not the type label alone.
- Product Image contains a browser-generated JPEG data URL. Option names and values use the app's ordered serialization; use the editor to keep them aligned.

See [daily workflows](workflows.md) for status transitions and metric definitions. Editing Sheets directly bypasses the app's save-time transition controls; preserving valid cell types alone does not guarantee a consistent inventory history.

## Legacy upgrades

The schema marker remains `1` while supported additive upgrades create missing Customers and Purchase Lots tabs and add these reference columns:

| Tab           | Column | Added header       |
| ------------- | ------ | ------------------ |
| Categories    | C      | Parent Category ID |
| Products      | G      | Image              |
| Orders        | L      | Customer ID        |
| Orders        | M      | Shipping Option    |
| Orders        | N      | Charges            |
| Orders        | O      | Partial Amount     |
| Stock Entries | H      | Purchase Lot ID    |

Reference-column migration checks for existing contents before writing a missing column. Photo-column setup has its own checks; move custom contents from Products G before adding photos. Back up a workbook before restructuring it and test migrations on a disposable copy. Do not rename managed tabs, reorder columns, or change IDs as a migration shortcut.

## Conflict and history rules

Queued changes retain the original and edited row values. Sync merges changed fields onto a fresh workbook: picopos wins for fields edited locally, while untouched fields retain remote values. Missing records or invalid merged operations remain queued for review. This is not a full audit history or a transactional reservation system across devices.

Keep shipped/completed order lines and received returns as history. Deleting rows or moving a shipped order back to a pre-shipment status directly in Sheets changes formula balances. Use returns for physical returns and stock entries for count corrections.
