export type HelpExample = {
  topic: string;
  id: string;
  title: string;
  description: string;
  frames: { image: string; caption: string }[];
};

export const HELP_EXAMPLES: HelpExample[] = [
  {
    topic: 'start',
    id: 'getting-started',
    title: 'Explore the demo and connection screen',
    description:
      'Start with the fictional demo shop. Connecting Google Sheets requires your own editable workbook.',
    frames: [
      {
        image: 'welcome',
        caption: 'Choose Try the demo to explore without connecting a Google account.',
      },
      {
        image: 'sales-report',
        caption: 'The demo opens a populated sales report. Demo edits reset when you reload or leave.',
      },
      {
        image: 'settings',
        caption: 'Open Settings to find currency, shipping options, workbook connection, and Leave demo.',
      },
    ],
  },
  {
    topic: 'workspace',
    id: 'navigation',
    title: 'Desktop tabs, mobile tabs, and appearance',
    description: 'Open pages keep their own tabs. These captures show desktop and 390-pixel mobile layouts.',
    frames: [
      {
        image: 'orders',
        caption: 'Use the sidebar for screens and the top tabs for open pages and records.',
      },
      {
        image: 'customer-history',
        caption: 'Opening a customer creates a detail tab with contact details and order history.',
      },
      {
        image: 'mobile-customer',
        caption: 'On a phone, the header offers an Open tabs button.',
      },
      {
        image: 'mobile-tabs',
        caption: 'Open tabs lists your pages and includes the appearance control.',
      },
      {
        image: 'dark-mode',
        caption: 'Night mode changes the workspace colors while keeping the same controls.',
      },
    ],
  },
  {
    topic: 'sales',
    id: 'sales-reporting',
    title: 'Read sales and estimated costs',
    description:
      'Compare the default period with a custom year-long range. Numbers and dates are illustrative demo values.',
    frames: [
      {
        image: 'sales-report',
        caption:
          'Read sales value, order count, average sale, and outstanding payments for the selected period.',
      },
      {
        image: 'sales-cost',
        caption: 'Select Show cost to overlay estimated cost and show estimated profit.',
      },
      {
        image: 'date-range',
        caption: 'Choose Date range, review From and To, then select Apply range.',
      },
      {
        image: 'year-report',
        caption:
          'The report recalculates for the selected dates. Inventory health still describes current stock.',
      },
    ],
  },
  {
    topic: 'catalog',
    id: 'create-product',
    title: 'Create a simple product',
    description: 'This example creates Everyday demo pouch with SKU HELP-POUCH-001 and a USD 18 price.',
    frames: [
      {
        image: 'products',
        caption: 'Open Products and select Add product.',
      },
      {
        image: 'new-product',
        caption: 'Enter the product name, unique SKU, and price. A photo and options are optional.',
      },
      {
        image: 'product-created',
        caption:
          'Save the product and search for Everyday demo pouch to find the new record. Stock is added separately in Inventory.',
      },
    ],
  },
  {
    topic: 'catalog',
    id: 'product-variants',
    title: 'Find, edit, and add variants',
    description:
      'Use Market Tote to inspect its existing variants and the product and variant editors. Editor captures show prepared forms, not saved variant changes.',
    frames: [
      {
        image: 'product-variants',
        caption:
          'Search for Market Tote and expand Variants to see Natural and Ink, their SKUs, prices, and status.',
      },
      {
        image: 'edit-product',
        caption:
          'Edit product holds the name, category, description, optional photo, option names, and Active product setting.',
      },
      {
        image: 'new-variant',
        caption: 'Add variant opens a form for a unique SKU, Color, price, and Active variant setting.',
      },
      {
        image: 'edit-variant',
        caption: 'Edit variant lets you update its SKU, option value, price, and active status.',
      },
    ],
  },
  {
    topic: 'catalog',
    id: 'categories',
    title: 'Create a nested category',
    description: 'This example adds Pouches beneath Bags.',
    frames: [
      {
        image: 'categories',
        caption: 'Open Categories to browse the category list.',
      },
      {
        image: 'new-category',
        caption: 'Select Add subcategory beside Bags, enter Pouches, and keep Bags as the parent.',
      },
      {
        image: 'category-created',
        caption: 'Save category. Pouches appears under Bags; parent categories group their descendants.',
      },
    ],
  },
  {
    topic: 'customers',
    id: 'customer-directory',
    title: 'Find a customer and inspect order history',
    description:
      'The fictional demo customer Maya Chen illustrates contact details and historical orders. This walkthrough does not save customer edits.',
    frames: [
      {
        image: 'customers',
        caption: 'Open Customers to browse saved contacts and their order counts.',
      },
      {
        image: 'customer-search',
        caption: 'Search for Maya to narrow the directory. Search can match contact fields as well as names.',
      },
      {
        image: 'customer-history',
        caption:
          'Open Maya Chen to review contact details, notes, and order history. Update customer saves edits when you make them.',
      },
    ],
  },
  {
    topic: 'orders',
    id: 'create-order',
    title: 'Create a two-unit draft order',
    description:
      'The example orders two Natural Market Totes at USD 28 each for Demo walkthrough customer, using free local pickup.',
    frames: [
      {
        image: 'orders',
        caption: 'Open Orders and select New order.',
      },
      {
        image: 'order-customer',
        caption: 'Expand Customer and enter a name, or select an existing saved customer.',
      },
      {
        image: 'order-items',
        caption:
          'Expand Order items, choose Market Tote / Natural, and set Quantity to 2. The item subtotal is USD 56.',
      },
      {
        image: 'order-validation',
        caption:
          'Saving without a shipping option shows Choose a shipping option. Fill the missing field before retrying.',
      },
      {
        image: 'order-shipping',
        caption:
          'Expand Payment, discount and shipping and choose Local pickup. The previous validation message clears after a successful save.',
      },
      {
        image: 'order-draft',
        caption:
          'Select Create draft. The saved order shows Draft and a USD 56 total; no stock is reserved yet.',
      },
    ],
  },
  {
    topic: 'orders',
    id: 'order-lifecycle',
    title: 'Confirm, ship, and complete an order',
    description:
      'These captures follow the same disposable demo order through all four states. Payment status is separate from fulfilment.',
    frames: [
      {
        image: 'order-draft',
        caption: 'Draft: review the items and total, then select Confirm order.',
      },
      {
        image: 'order-confirmed',
        caption:
          'In progress: confirmation reserves the two units. Mark shipped advances the whole order; Cancel order releases reservations.',
      },
      {
        image: 'order-shipped',
        caption: 'Shipped: stock has left on hand and reservations are cleared. Returns are now available.',
      },
      {
        image: 'order-completed',
        caption: 'Completed: select Mark completed after fulfilment. You can still record returned items.',
      },
    ],
  },
  {
    topic: 'orders',
    id: 'payments',
    title: 'Inspect payment and fulfilment separately',
    description:
      'Payment choices record activity outside picopos. The app does not charge customers or send refunds.',
    frames: [
      {
        image: 'order-in-progress',
        caption: 'An In progress order can remain Unpaid: fulfilment and payment are independent.',
      },
      {
        image: 'payment-options',
        caption:
          'Payment status offers Unpaid, Paid, and Refunded. Refunded orders are excluded from report sales.',
      },
      {
        image: 'completed-order',
        caption: 'A completed order retains its payment status, item details, totals, and returns section.',
      },
    ],
  },
  {
    topic: 'returns',
    id: 'returns',
    title: 'Request a partial return and inspect receipt conditions',
    description:
      'The first two captures save a one-unit request against a two-unit demo order. The remaining captures illustrate receipt choices on another shipped demo order; receipt is not shown as completed.',
    frames: [
      {
        image: 'partial-return',
        caption:
          'From a Shipped or Completed order, select Add return, choose the item, and enter 1 of the 2 shipped units.',
      },
      {
        image: 'return-requested',
        caption:
          'Save as Requested. The return row offers a condition selector and Receive when the item arrives.',
      },
      {
        image: 'return-request',
        caption: 'A new return form can also start with Requested status.',
      },
      {
        image: 'return-sellable',
        caption:
          'Selecting Received reveals Condition. Sellable returns increase on-hand and available stock.',
      },
      {
        image: 'return-damaged',
        caption:
          'Choose Damaged for an unsellable return. It increases on-hand and unavailable stock, not available stock.',
      },
    ],
  },
  {
    topic: 'inventory',
    id: 'stock-movements',
    title: 'Read balances and preview every stock movement',
    description:
      'These are unsaved previews for FW-001-NAT. Always check the resulting balances before saving.',
    frames: [
      {
        image: 'inventory',
        caption: 'Inventory summarizes on-hand, reserved, unavailable, and available quantities.',
      },
      {
        image: 'stock-search',
        caption: 'Search for FW-001-NAT, then choose its Add stock entry action.',
      },
      {
        image: 'stock-receipt',
        caption: 'Receipt with quantity 5 previews adding five delivered units.',
      },
      {
        image: 'stock-opening-stock',
        caption: 'Opening stock establishes an initial quantity. Use it for starting balances.',
      },
      {
        image: 'stock-adjustment',
        caption: 'Adjustment exposes a Direction field so you can add or remove on-hand stock.',
      },
      {
        image: 'stock-damaged',
        caption:
          'Damaged moves units from available into unavailable stock without changing physical on-hand stock.',
      },
      {
        image: 'stock-restocked',
        caption:
          'Restocked moves unavailable units back to available. This example has no unavailable units, so the preview is invalid and must not be saved.',
      },
      {
        image: 'stock-entries',
        caption: 'Stock entries lists recorded movements and their purchase-lot links.',
      },
    ],
  },
  {
    topic: 'inventory',
    id: 'purchase-lots',
    title: 'Inspect purchase costs and linked stock',
    description:
      'The lot editor example is prepared but not saved. A lot records costs; linked stock entries record physical receipts.',
    frames: [
      {
        image: 'purchase-lots',
        caption:
          'Open Purchase lots to compare purchase amount, purchased units, linked units, and average unit cost.',
      },
      {
        image: 'lot-entries',
        caption: 'Expand a lot using its Stock entries action to inspect the linked variants and quantities.',
      },
      {
        image: 'new-lot',
        caption:
          'Add purchase lot: Demo pouch delivery, USD 120, and 20 units implies USD 6 per unit. Saving a lot alone adds no stock.',
      },
    ],
  },
  {
    topic: 'settings',
    id: 'shipping-settings',
    title: 'Configure currency and shipping rates',
    description: 'These captures show current settings and an unsaved Express delivery example.',
    frames: [
      {
        image: 'settings',
        caption:
          'Settings contains Currency and shipping. Changing the currency does not convert existing amounts.',
      },
      {
        image: 'shipping-rate',
        caption:
          'Select Add shipping option and enter Express delivery at USD 9.95. Save settings applies the change; use a zero rate for pickup.',
      },
    ],
  },
];
