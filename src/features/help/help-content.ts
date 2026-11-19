import { HELP_EXAMPLES, type HelpExample } from './help-examples';

type HelpTopic = {
  id: string;
  title: string;
  path: string;
  screen: string;
  description: string;
  articles: { title: string; paragraphs?: string[]; steps?: string[]; example?: HelpExample }[];
};

const topics: HelpTopic[] = [
  {
    id: 'start',
    title: 'Getting started',
    path: '/settings',
    screen: 'Settings',
    description: 'Connect your workbook, invite your team, or explore the demo.',
    articles: [
      {
        title: 'Connect Google Sheets',
        paragraphs: [
          'Select Connect a workbook on the welcome screen, or go to Settings. Open Create a new workbook, enter your shop name, and select Create workbook. To connect a file you already use, select Choose an existing workbook. New files are named “picopos · Your shop”. When you connect a workbook for the first time and it has no picopos settings, choose a currency, shipping options, and a sync interval before finishing setup. The sync interval applies to this browser. The chooser starts by searching for “picopos”. If an older workbook has a different name, search for it by filename. Sign in with an account that can edit the file. picopos creates its managed tabs and leaves unrelated tabs alone.',
          'Your workbook holds products, variants, customers, orders, order items, returns, stock entries, purchase lots, categories, and settings. Keep managed headers and record IDs intact when editing Sheets directly.',
        ],
      },
      {
        title: 'Work with staff',
        paragraphs: [
          'Share the spreadsheet with each staff member and grant edit access. Each person connects with their own Google account. Spreadsheet sharing controls who can access the workbook.',
          'Tabs in the same browser profile coordinate saves. Different devices do not share an atomic stock reservation, so review inventory warnings when several people confirm orders at once.',
        ],
      },
      {
        title: 'Try the demo',
        paragraphs: [
          'Choose Try the demo to explore a populated shop without connecting Google. It includes products, variants, customers, a year of orders, stock movements, and purchase lots. Demo prices use USD; customer details are fictional.',
          'You can change demo records to practise. Changes last only until you reload or leave the demo. Choose Leave demo in Settings to return to connection setup.',
        ],
      },
      {
        title: 'A first-sale checklist',
        steps: [
          'Set your currency and shipping rates in Settings.',
          'Create categories, products, and variants in Products.',
          'Record opening stock or a delivery in Inventory; link purchase lots if you want cost estimates.',
          'Create an order, select the customer and items, and save a draft.',
          'Confirm the order, record payment status, ship it, and mark it completed.',
          'Review the Dashboard and check sync status in Settings.',
        ],
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace & navigation',
    path: '/dashboard',
    screen: 'Dashboard',
    description: 'Move between screens, keep records open, and choose your theme.',
    articles: [
      {
        title: 'Sidebar and open tabs',
        paragraphs: [
          'Use the sidebar to open Dashboard, Orders, Products, Customers, Inventory, or Settings. Help opens documentation in a separate browser tab from the sidebar footer. Open pages appear as tabs across the top; select a tab to return or use its close button.',
          'Order details, new orders, and customer details can open as separate tabs. Forms and filters stay with their mounted tab when you switch away. Closing a tab or reloading does not preserve unsaved form edits. On smaller screens, use Open tabs to manage your pages.',
        ],
      },
      {
        title: 'Direct links and browser history',
        paragraphs: [
          'Each screen has a URL such as #/orders, #/inventory/lots, or /help/. You can bookmark it, reload it, or use browser Back and Forward. A record link still requires access to the workbook containing that record.',
        ],
      },
      {
        title: 'Light and dark themes',
        paragraphs: [
          'Use the appearance control in the header to switch between day and night modes. On smaller screens, Appearance is available in the Open tabs panel. The same theme applies to forms, reports, and Help.',
        ],
      },
    ],
  },
  {
    id: 'sales',
    title: 'Sales report',
    path: '/dashboard',
    screen: 'Dashboard',
    description: 'Explore sales, estimated cost and profit, order status, and stock health.',
    articles: [
      {
        title: 'Reporting periods and custom dates',
        paragraphs: [
          'Choose 7, 30, or 90 days for a period ending today. Date range lets you select inclusive From and To dates within the available order history, including a single day. Presets without orders and invalid or empty custom ranges are disabled.',
          'Report periods use order creation dates in your browser’s local time zone. Pending local changes are included. The report reflects each order’s current status, rather than its status at a past point in time.',
        ],
      },
      {
        title: 'Sales, averages, and outstanding payments',
        paragraphs: [
          'Sales value adds item subtotals, subtracts discounts, and adds shipping for In progress, Shipped, and Completed orders. Drafts, cancellations, and orders marked Refunded are excluded. Unpaid confirmed orders still count as sales.',
          'Average sale divides sales value by the number of qualifying orders. Orders placed counts every order in the period, including drafts and cancellations. Outstanding payments adds unpaid In progress, Shipped, and Completed order totals.',
        ],
      },
      {
        title: 'Trend graph and hover details',
        paragraphs: [
          'The sales line groups values by creation day. Hover over a point, tap it, or focus it with the keyboard to see the date, sales value, sales count, and estimated profit. Escape dismisses the tooltip.',
          'Show cost overlays an amber dashed estimated-cost line and adds cost and profit totals in the chart header. Both lines use the same currency scale. Hide cost removes the overlay.',
        ],
      },
      {
        title: 'How estimated cost and profit work',
        paragraphs: [
          'For each sold variant, picopos uses positive Opening stock and Receipt entries linked to purchase lots and dated no later than the sale. A lot’s unit cost is its total purchase amount divided by total purchased units. Eligible receipts are weighted by their quantities, then multiplied by units sold.',
          'Estimated profit is sales value minus estimated product cost. It excludes delivery expenses and other operating expenses, so it is not net profit. Lot costs are averages, not exact costs assigned to each sold unit. Editing lot amounts can change past estimates.',
          'Cost and profit include only items with eligible cost history. Each item receives a share of order discounts and shipping based on its sales value, or its quantity when the order subtotal is zero. The summary counts sold units missing costs. A day with sales has a gap in the cost line if no sold units match. Received returns do not automatically subtract sales or refund amounts.',
        ],
      },
      {
        title: 'Order status, top products, and inventory health',
        paragraphs: [
          'Order status shows the distribution of all orders created in the selected period. Top products ranks the five products with the most units on qualifying confirmed sales; the list scrolls within its card.',
          'Inventory health shows current stock across all dates, regardless of the report period. Active variants with five or fewer available units need attention. View stock opens Inventory. Returns are not deducted from the top-products ranking.',
        ],
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Products & categories',
    path: '/catalog',
    screen: 'Products',
    description: 'Maintain your catalog, options, SKUs, pricing, photos, and category tree.',
    articles: [
      {
        title: 'Create and edit products',
        steps: [
          'Open Products and choose the new-product action.',
          'Enter the product name, category, description, and optional option names such as Color and Size.',
          'Set the first variant’s SKU, option values, and price, then save.',
          'Expand the product to view its variants. Use Edit product, Add variant, or Edit variant to make further changes.',
        ],
        paragraphs: [
          'Product records describe the item; variants hold the sellable SKU and price. Creating a product or variant does not add stock.',
        ],
      },
      {
        title: 'Variants, prices, and active status',
        paragraphs: [
          'Give every variant a unique SKU. SKU comparison ignores case and surrounding whitespace. Option values follow the same order as the product’s option names. Prices must be nonnegative.',
          'Use the active setting to archive products or variants without deleting their history. Order lines retain the product name, variant name, SKU, and price recorded when the order was created; later catalog edits do not rewrite those snapshots.',
        ],
      },
      {
        title: 'Search and category filters',
        paragraphs: [
          'Search Products by name or SKU, then narrow the list by category and product status. Clear filters resets the selection. Expand a product to inspect its variants.',
          'Open Categories to create, search, and edit categories. Choose an optional parent to build a hierarchy. A category cannot be its own parent or a descendant of itself.',
        ],
      },
      {
        title: 'Product photos',
        paragraphs: [
          'Photos are optional. Use the product photo control to choose a supported image or remove an existing photo. The app compresses the image for storage in the workbook; keep your original separately.',
          'JPEG, PNG, WebP, AVIF, and HEIC-family files up to 24 MiB are accepted, subject to browser decoding support. If an image cannot be read, try a JPEG copy. Images are stored in the spreadsheet rather than a separate image service.',
        ],
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    path: '/customers',
    screen: 'Customers',
    description: 'Manage contact details and review each customer’s order history.',
    articles: [
      {
        title: 'Create, find, and edit customers',
        paragraphs: [
          'Create a customer with a name and optional contact details, address, and notes. Search by name, phone, email, or address and use the status filter to narrow the directory.',
          'Open a customer to see contact details and order history. Use the active setting to archive a saved customer without deleting historical orders.',
        ],
      },
      {
        title: 'Saved customers and historical contacts',
        paragraphs: [
          'The directory includes saved customers and contacts found on older, unlinked orders. Select a saved customer when creating an order to connect the new order to their history.',
          'Orders keep their own customer, contact, and address snapshots. Editing a customer does not rewrite earlier orders. Historical contacts are not automatically merged with saved records just because their names match.',
        ],
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders & payments',
    path: '/orders',
    screen: 'Orders',
    description: 'Create drafts, confirm stock, fulfil orders, and track payment separately.',
    articles: [
      {
        title: 'Find orders and follow the order journey',
        paragraphs: [
          'The order journey groups orders by status. Select a stage to filter the list or open a record directly. The order list supports order-number or customer search and status filtering.',
          'Opening an order shows its saved customer details, items, totals, payment status, and returns. Detail tabs let you switch between records without losing the list.',
        ],
      },
      {
        title: 'Create a draft',
        steps: [
          'Choose the new-order action in Orders.',
          'Select a customer or enter customer details, then add one or more variants.',
          'Set positive whole-number quantities and review unit prices.',
          'Choose shipping, enter any discount and notes, and save the draft.',
        ],
        paragraphs: [
          'Order total equals quantity × unit price across all lines, minus discount, plus shipping. The discount cannot exceed the item subtotal. Drafts do not reserve inventory.',
        ],
      },
      {
        title: 'Confirm, ship, complete, or cancel',
        paragraphs: [
          'The normal sequence is Draft → In progress → Shipped → Completed. Confirmation reserves stock, and shipping deducts on-hand quantities and clears those reservations. Stock availability is checked when confirming and shipping.',
          'Draft and In progress orders can be cancelled, releasing any reservations. Completed and Cancelled orders cannot be advanced further. Shipping applies to the whole order; use returns for items that come back after shipping.',
        ],
      },
      {
        title: 'Record payment status',
        paragraphs: [
          'Payment is tracked separately as Unpaid, Paid, or Refunded in order details. Changing payment status does not confirm, ship, cancel, or move inventory.',
          'Marking an order Refunded excludes it from report sales. The app does not process a payment or transfer a refund to the customer. Payment status is a record of what happened outside picopos.',
        ],
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns',
    path: '/orders',
    screen: 'Orders',
    description: 'Record partial or full returns and distinguish sellable from damaged stock.',
    articles: [
      {
        title: 'Request or receive a return',
        steps: [
          'Open a Shipped or Completed order and start a return.',
          'Choose the order item and the quantity being returned.',
          'Save it as Requested, or record it as Received with its condition when it has arrived.',
          'For a requested return, choose Sellable or Damaged and select Receive when the item comes back.',
        ],
        paragraphs: [
          'You can return part or all of an order item’s quantity. Combined requested and received returns cannot exceed the shipped quantity. Receipt records the date; received returns cannot be edited through the normal save flow.',
        ],
      },
      {
        title: 'What returns change',
        paragraphs: [
          'Requested returns do not move stock. A received Sellable return increases on-hand and available stock. A received Damaged return increases on-hand and unavailable stock, leaving available stock unchanged.',
          'A stock return and a payment refund are separate records. Receiving a return does not automatically mark the order Refunded or subtract a partial refund from report sales.',
        ],
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & purchase lots',
    path: '/inventory',
    screen: 'Inventory',
    description: 'Track stock balances, receipts, condition changes, and purchasing costs.',
    articles: [
      {
        title: 'Read stock balances',
        paragraphs: [
          'Inventory has Stock, Stock entries, and Purchase lots views. Search by product or SKU to find a variant. The stock summary covers all variants.',
          'On hand is physical stock remaining after shipments and received returns. Reserved is held by In progress orders. Unavailable is stock that cannot be sold. Available = on hand − reserved − unavailable.',
        ],
      },
      {
        title: 'Record stock movements',
        steps: [
          'Choose the add-stock-entry action, either globally or beside a variant.',
          'Select the variant, entry type, and positive whole-number quantity. For an Adjustment, choose whether to add or remove on-hand stock.',
          'Optionally select a purchase lot and enter notes.',
          'Review the After this entry balance preview and save.',
        ],
        paragraphs: [
          'Opening stock establishes starting quantities. Receipt adds a delivery. Adjustment corrects a count. Damaged moves units into unavailable stock; Restocked moves them back to sellable stock. The app rejects changes that make physical or unavailable balances inconsistent.',
        ],
      },
      {
        title: 'Create and reconcile purchase lots',
        paragraphs: [
          'In Purchase lots, create a lot with its name, total purchase amount, and total purchased units. Creating the lot alone does not add stock: record stock entries linked to it.',
          'Expand a lot to inspect linked products and stock entries. Compare linked units with declared purchased units and review any difference. Sales do not reduce linked purchase quantities. Signed stock corrections can change the linked-unit total.',
          'Use the purchase-lot action on a stock entry to change or clear its link. A lot’s average unit cost is total amount ÷ total units. Positive linked opening stock and receipts supply the Dashboard’s cost estimates.',
        ],
      },
      {
        title: 'Low stock and inventory issues',
        paragraphs: [
          'The Dashboard highlights active variants with five or fewer available units. Use View stock to inspect them and record replenishment as a receipt.',
          'If a balance warning appears after sync, review stock entries, reservations, and returns. Simultaneous edits from different devices can over-reserve stock. Correct the underlying record or enter a justified stock adjustment instead of hiding the warning.',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Business settings',
    path: '/settings',
    screen: 'Settings',
    description: 'Choose currency, maintain shipping rates, and manage the connection.',
    articles: [
      {
        title: 'Currency and shipping rates',
        paragraphs: [
          'Choose your workbook currency in Settings and save. It changes currency formatting across the app; it does not convert existing prices or historical amounts.',
          'Add named shipping options with nonnegative rates. A zero rate works for pickup or free delivery. Orders store their selected option and charge, so editing a configured rate does not recalculate existing orders.',
        ],
      },
      {
        title: 'Reconnect, switch accounts, or disconnect',
        paragraphs: [
          'If Google access expires, choose Reconnect to resume sync. Use Use another Google account when you need a different account with access to the workbook.',
          'Review pending changes before changing workbooks or disconnecting. Unsynced work belongs to the current browser profile and has not yet reached Google Sheets. Offline copies are encrypted on this device, but anyone using the unlocked browser profile can still open them. On a shared device, sync and disconnect when finished to remove the current workbook’s local copy. Do not clear site data while changes are pending. The demo has its own Leave demo action.',
        ],
      },
    ],
  },
  {
    id: 'sync',
    title: 'Offline work & sync',
    path: '/settings',
    screen: 'Settings',
    description: 'Understand local saves, queued edits, conflicts, and recovery.',
    articles: [
      {
        title: 'Local saves and offline access',
        paragraphs: [
          'In a connected workspace, saving updates this browser’s workbook first and queues changes for Google Sheets. After a successful connection, supported browsers keep the workbook and edit queue locally so you can continue working offline.',
          'Production builds cache the app shell after an online visit. The development server does not provide that offline shell. Clearing site data or losing browser storage can remove unsynced edits, so check sync before closing or moving to another device.',
        ],
      },
      {
        title: 'Automatic and manual sync',
        paragraphs: [
          'Open Settings → Workbook connection to see connection and queue status. Choose the minimum sync interval or use Sync now for an immediate attempt while online. The default automatic interval is 30 seconds.',
          'Sync runs while the app is open. Returning to the tab or coming back online triggers a check when due. It reads Sheet changes and uploads queued edits in batches; it does not run continuously after the app closes.',
        ],
      },
      {
        title: 'Preview pending edits and resolve issues',
        paragraphs: [
          'Expand Preview queued changes to inspect pending records and validation issues. Edits that reference deleted records or fail validation remain queued for review.',
          'If both picopos and Sheets changed the same field, the picopos value wins. Sheet changes to unrelated fields are preserved. Use Discard local change only for an issue you want to abandon; it removes that queued edit rather than fixing it.',
        ],
      },
      {
        title: 'Troubleshooting',
        steps: [
          'Check your internet connection and the sync message in Settings.',
          'Reconnect if Google authorization has expired; verify that your account still has spreadsheet edit access.',
          'Inspect queued changes for validation issues and review any inventory warnings.',
          'Check that managed Sheet headers and IDs have not been removed or changed.',
          'Retry Sync now once the cause is resolved. Avoid clearing browser storage while changes are still pending.',
        ],
      },
    ],
  },
];

export const HELP_TOPICS: HelpTopic[] = topics.map((topic) => ({
  ...topic,
  articles: [
    ...topic.articles,
    ...HELP_EXAMPLES.filter((example) => example.topic === topic.id).map((example) => ({
      title: `Watch & follow: ${example.title}`,
      paragraphs: [example.description],
      example,
    })),
  ],
}));
