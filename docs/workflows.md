# Daily workflows

Start with [setup](../README.md#connect-google-sheets). Connected saves update this browser first; check **Settings → Sync settings** to confirm that changes reached Sheets. The demo uses in-memory data and resets when you leave or reload.

## Catalog and customers

Create a product with a name, SKU, and price. Add option names such as Color and Size when a product has variants; option values follow the same order as their names. SKUs must be unique ignoring case and surrounding whitespace. Categories can have parents, but cannot form cycles.

Product photos are stored in the workbook as JPEG data URLs, not uploaded to a separate image service. The picker accepts JPEG, PNG, WebP, AVIF, and HEIC-family files up to 24 MiB; decoding depends on browser support. Conversion tries progressively smaller sizes and quality levels until the data URL fits 45,000 characters. Use a JPEG copy if the browser cannot decode a photo. Keep originals separately.

The customer directory combines saved customer records with historical order contacts. Orders retain their own customer/contact/address snapshots; editing a saved customer does not rewrite past orders. Set Active to `FALSE` to archive saved customers, products, or variants without deleting historical references.

## Orders and returns

1. Create a draft with a customer and at least one item. Quantities must be positive whole numbers; prices must be nonnegative.
2. Choose shipping and discount details. The discount cannot exceed the item subtotal. The total is item subtotal minus discount plus shipping.
3. Confirm the draft to move it to **In progress** and reserve stock. Confirmation and shipping check available stock locally and again during sync.
4. Mark the whole order **Shipped**, then **Completed** when appropriate. Draft and In progress orders can instead be cancelled.

The supported transitions are `Draft → In progress → Shipped → Completed`, with cancellation from Draft or In progress only. Completed and Cancelled are terminal states in the app. Payment status (`Unpaid`, `Paid`, or `Refunded`) is separate from fulfillment status and does not itself move stock.

Order lines snapshot product name, variant name, SKU, and unit price. Keep shipped lines intact. Receive partial or full returns against shipped/completed order items, specifying the receipt date and Sellable or Damaged condition. Requested returns do not move stock. Received sellable returns increase available stock; damaged returns increase on-hand and unavailable stock together. The total requested and received return quantity cannot exceed the shipped item quantity. A received return cannot be edited through the domain save path.

## Stock and purchase lots

Use **Inventory** for balances, **Stock entries** for movements, and **Purchase lots** for purchase totals and linked stock. Opening stock and receipts establish quantities; adjustments correct counts; Damaged and Restocked record condition changes. Available stock is on hand minus reserved minus unavailable.

A purchase lot records its name, total purchase amount, and total purchased units. Creating a lot alone does not add stock. Link stock entries to the lot to track units by product. The linked-unit summary adds signed on-hand changes, so corrections can reduce it. The lot's declared unit count is not automatically reconciled to linked entries. Lot amounts are not used to calculate dashboard profit or cost of goods sold.

Review negative balances after sync, especially when several staff members confirm orders concurrently. Browser locks coordinate tabs in one browser profile; they cannot make stock reservations transactional across devices.

## Currency and shipping

In **Settings**, choose the workbook currency and define named shipping rates, including a zero rate for pickup. Changing currency changes how amounts are displayed; it does not convert prices or historical amounts. Orders store their shipping option and charge, so changing a configured rate does not recalculate existing orders.

## Dashboard

The selected period filters orders by creation date using the browser's local calendar days, including today. Metrics use the current projected workbook, so pending local changes are included.

| Metric                  | Definition                                                               |
| ----------------------- | ------------------------------------------------------------------------ |
| Orders placed           | All orders created in the period, including drafts and cancellations     |
| Fulfilled order value   | Totals of Shipped or Completed orders, excluding payment status Refunded |
| Average fulfilled order | Fulfilled order value divided by the number of those orders              |
| Unpaid order value      | Unpaid In progress, Shipped, or Completed orders created in the period   |
| Top products            | Units on qualifying fulfilled orders, grouped by product; top five       |
| Stock totals            | Current balances across the workbook, independent of the date filter     |
| Low stock               | Active variants of active products with available stock at or below five |

Fulfilled value can include unpaid orders and includes shipping minus discounts. Received returns do not reduce it automatically. The trend assigns value to the order's creation day, not its shipment or payment day. These are operational summaries, not cash receipts or profit reporting.

See [workbook reference](workbook.md) for direct Sheets edits and [troubleshooting](troubleshooting.md) for sync recovery.
