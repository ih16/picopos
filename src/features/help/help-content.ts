type Guide = { title: string; steps?: string[]; paragraphs?: string[]; example?: string };
type HelpTopic = {
  id: string;
  title: string;
  path: string;
  screen: string;
  description: string;
  articles: Guide[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'Getting started',
    path: '/settings',
    screen: 'Settings',
    description: 'Open a practice shop or connect your own.',
    articles: [
      {
        title: 'Try the demo',
        example: 'getting-started',
        paragraphs: [
          'Choose Try the demo on the welcome screen. You can practise with fictional records. Reloading or choosing Leave demo in Settings resets your changes.',
        ],
      },
      {
        title: 'Connect a Google workbook',
        steps: [
          'Choose Connect a workbook and sign in with a Google account that can edit the spreadsheet.',
          'Create a workbook for your shop, or choose an existing one by filename. On first setup, choose your currency, shipping rates and sync interval.',
          'To invite staff, share the spreadsheet with edit access. Each person connects it with their own account. Keep managed column headers and record IDs intact.',
        ],
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    path: '/dashboard',
    screen: 'Dashboard',
    description: 'Switch screens and return to open records.',
    articles: [
      {
        title: 'Navigate on a phone or desktop',
        example: 'navigation',
        paragraphs: [
          'On a phone, use the bottom bar. Open More (⋮) for Settings and Help. Tap Open tabs in the header to switch records or change appearance.',
          'On desktop, use the sidebar for screens and the top tabs for open records. Switch tabs to keep a draft open. Closing its tab or reloading can discard unsaved form edits.',
          'On small screens, tap the filter icon to search or change filters. Its badge counts active filters.',
        ],
      },
    ],
  },
  {
    id: 'sales',
    title: 'Sales report',
    path: '/dashboard',
    screen: 'Dashboard',
    description: 'Track sales, payments and estimated profit.',
    articles: [
      {
        title: 'Read sales for a period',
        example: 'sales-reporting',
        steps: [
          'Choose a preset or use Date range to set From and To. Select Apply range.',
          'Read sales, average sale and outstanding payments. Orders belong to their creation date. Draft, cancelled and refunded orders are excluded. Sales include shipping and discounts.',
        ],
        paragraphs: [
          'Inventory health shows current stock. Recording a return does not automatically refund the sale.',
        ],
      },
      {
        title: 'Read estimated cost and profit',
        paragraphs: [
          'Select Show cost on the trend chart. Estimated cost uses weighted costs from eligible purchase receipts as of the sale. Check the count of units missing cost before relying on estimated profit.',
        ],
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Products & categories',
    path: '/catalog',
    screen: 'Products',
    description: 'Organize products and manage sellable variants.',
    articles: [
      {
        title: 'Create a product',
        example: 'create-product',
        steps: [
          'In Products, choose Add product. Enter its name and optionally a category, description or photo.',
          'Enter a unique SKU and price, then choose Save product. Record opening stock in Inventory.',
        ],
      },
      {
        title: 'Manage variants',
        example: 'product-variants',
        paragraphs: [
          'Use Add options for choices such as size or colour. Expand a product’s variants and choose Edit to change a SKU, price or active status. SKUs must be unique regardless of letter case.',
        ],
      },
      {
        title: 'Create a subcategory',
        example: 'categories',
        paragraphs: [
          'Open Categories. Choose Add subcategory on the parent, enter a name and save. Choose Add category for a top-level group.',
        ],
      },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    path: '/customers',
    screen: 'Customers',
    description: 'Find contacts and their order history.',
    articles: [
      {
        title: 'Find or update a customer',
        example: 'customer-directory',
        paragraphs: [
          'Search by name, phone, email or address. Open a customer to review their details and orders. Use Add customer to create a saved contact.',
          'From orders identifies contacts found in order history. Saved contacts can be edited or archived. Historical orders keep the details recorded at the time.',
        ],
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders & payments',
    path: '/orders',
    screen: 'Orders',
    description: 'Prepare a draft and follow it through delivery.',
    articles: [
      {
        title: 'Create a draft order',
        example: 'create-order',
        steps: [
          'In Orders, choose New order. Select a customer or enter their details.',
          'Add each item and quantity. Review prices, discount, shipping option and total.',
          'Choose Create draft. Stock is reserved when you confirm the order.',
        ],
      },
      {
        title: 'Ship and complete an order',
        example: 'order-lifecycle',
        paragraphs: [
          'Confirm a draft when the items are available. Mark shipped when they leave your shop, then mark completed after delivery. Shipping deducts on-hand stock. Cancelling a confirmed order releases its reservation.',
        ],
      },
      {
        title: 'Record a payment',
        example: 'payments',
        paragraphs: [
          'Open the order and select Unpaid, Paid or Refunded under Payment status. Update payment and fulfilment separately.',
        ],
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns',
    path: '/orders',
    screen: 'Orders',
    description: 'Track returned items and their condition.',
    articles: [
      {
        title: 'Request or receive a return',
        example: 'returns',
        steps: [
          'Open a shipped or completed order and choose Add return. Select the item and quantity.',
          'Save a request if the goods are still with the customer. When received, record their condition. Sellable units become available again. Damaged units are unavailable.',
          'If you refund the customer, update the order’s payment status separately.',
        ],
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & purchase lots',
    path: '/inventory',
    screen: 'Inventory',
    description: 'Record stock movements and trace purchase costs.',
    articles: [
      {
        title: 'Record a stock movement',
        example: 'stock-movements',
        paragraphs: [
          'Find the SKU in Stock and choose Add stock entry. Select the movement, enter the quantity and review the balance before saving.',
          'Use opening stock for a starting balance, receipt for incoming goods and adjustment for corrections. Damaged moves units to unavailable. Restocked releases unavailable units. Available stock excludes reserved and unavailable units.',
        ],
      },
      {
        title: 'Review a purchase lot',
        example: 'purchase-lots',
        paragraphs: [
          'Open Inventory → Purchase lots and expand a lot to see linked stock entries. To record a purchase, add a lot with its cost and link the corresponding receipts. Creating the lot alone does not increase stock.',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Shop settings',
    path: '/settings',
    screen: 'Settings',
    description: 'Set currency, number format and delivery charges.',
    articles: [
      {
        title: 'Set currency and shipping rates',
        example: 'shipping-settings',
        paragraphs: [
          'In Settings, choose the currency and number format. Changing currency does not convert existing amounts.',
          'Choose Add shipping option, enter a name and rate, then save settings. Use zero for free delivery or pickup.',
        ],
      },
    ],
  },
  {
    id: 'sync',
    title: 'Offline work & sync',
    path: '/settings',
    screen: 'Settings',
    description: 'Check what is saved locally and what has reached Sheets.',
    articles: [
      {
        title: 'Sync local changes',
        paragraphs: [
          'Edits queue in this browser until they reach Sheets. After an online visit, the production app can reopen offline. Keep the app open while syncing.',
          'Open Settings → Workbook connection to check the queue or choose Sync now. The default minimum interval is 30 seconds. Check for pending edits before switching devices, disconnecting or clearing browser storage.',
        ],
      },
      {
        title: 'Resolve a sync issue',
        steps: [
          'Check your connection and spreadsheet edit access. Reconnect if Google authorization has expired.',
          'Open Preview queued changes to identify the affected record. Check its references and the managed sheet headers, then retry Sync now.',
          'If both sides edited the same field, the local value wins. Other Sheet fields are preserved. Use Discard local change only when you intend to abandon that queued edit.',
        ],
      },
    ],
  },
];
