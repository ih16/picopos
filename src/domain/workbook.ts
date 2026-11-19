import { orderSubtotal } from './order-totals.ts';

export const ORDER_STATUSES = ['Draft', 'In progress', 'Shipped', 'Completed', 'Cancelled'] as const;
export const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Refunded'] as const;
export const RETURN_STATUSES = ['Requested', 'Received'] as const;
export const RETURN_CONDITIONS = ['Sellable', 'Damaged'] as const;
export const STOCK_TYPES = ['Opening stock', 'Receipt', 'Adjustment', 'Damaged', 'Restocked'] as const;
export const MAX_PRODUCT_IMAGE_LENGTH = 45_000;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];
type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type StockType = (typeof STOCK_TYPES)[number];

type Setting = { id: string; value: string };
export type Customer = {
  id: string;
  name: string;
  contact: string;
  address: string;
  notes: string;
  active: boolean;
};
export type Category = { id: string; name: string; parentId?: string };
export type Product = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  optionNames: string;
  active: boolean;
  image?: string;
};
export type Variant = {
  id: string;
  productId: string;
  sku: string;
  optionValues: string;
  price: number;
  active: boolean;
};
export type Order = {
  shippingOption?: string;
  customerId?: string;
  id: string;
  number: string;
  createdAt: string;
  customer: string;
  contact: string;
  address: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  notes: string;
  discount: number;
  shippingCharge: number;
};
export type OrderItem = {
  id: string;
  orderId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};
export type Return = {
  id: string;
  orderItemId: string;
  quantity: number;
  status: ReturnStatus;
  condition: ReturnCondition | '';
  receivedAt: string;
  notes: string;
};
export type PurchaseLot = { id: string; name: string; totalAmount: number; totalUnits: number };
export type StockEntry = {
  purchaseLotId?: string;
  id: string;
  variantId: string;
  date: string;
  type: StockType;
  onHandDelta: number;
  unavailableDelta: number;
  notes: string;
};

export type TableRows = {
  'Purchase Lots': PurchaseLot;
  Settings: Setting;
  Categories: Category;
  Customers: Customer;
  Products: Product;
  Variants: Variant;
  Orders: Order;
  'Order Items': OrderItem;
  Returns: Return;
  'Stock Entries': StockEntry;
};
export type TableName = keyof TableRows;
export type WorkbookData = { [K in TableName]: TableRows[K][] };
export type RowChange = { [K in TableName]: { tab: K; row: TableRows[K] } }[TableName];

export const HEADERS = {
  'Purchase Lots': ['id', 'name', 'totalAmount', 'totalUnits'],
  Settings: ['id', 'value'],
  Categories: ['id', 'name', 'parentId'],
  Customers: ['id', 'name', 'contact', 'address', 'notes', 'active'],
  Products: ['id', 'name', 'categoryId', 'description', 'optionNames', 'active', 'image'],
  Variants: ['id', 'productId', 'sku', 'optionValues', 'price', 'active'],
  Orders: [
    'id',
    'number',
    'createdAt',
    'customer',
    'contact',
    'address',
    'status',
    'paymentStatus',
    'notes',
    'discount',
    'shippingCharge',
    'customerId',
    'shippingOption',
  ],
  'Order Items': ['id', 'orderId', 'variantId', 'productName', 'variantName', 'sku', 'quantity', 'unitPrice'],
  Returns: ['id', 'orderItemId', 'quantity', 'status', 'condition', 'receivedAt', 'notes'],
  'Stock Entries': [
    'id',
    'variantId',
    'date',
    'type',
    'onHandDelta',
    'unavailableDelta',
    'notes',
    'purchaseLotId',
  ],
} as const satisfies { [K in TableName]: readonly (keyof TableRows[K])[] };

export function emptyWorkbook(): WorkbookData {
  return {
    'Purchase Lots': [],
    Settings: [],
    Categories: [],
    Customers: [],
    Products: [],
    Variants: [],
    Orders: [],
    'Order Items': [],
    Returns: [],
    'Stock Entries': [],
  };
}

export function makeId() {
  return crypto.randomUUID();
}

export function isShipped(status: OrderStatus) {
  return status === 'Shipped' || status === 'Completed';
}

export const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  Draft: ['In progress', 'Cancelled'],
  'In progress': ['Shipped', 'Cancelled'],
  Shipped: ['Completed'],
  Completed: [],
  Cancelled: [],
};

type InventoryRow = {
  variantId: string;
  onHand: number;
  reserved: number;
  unavailable: number;
  available: number;
};

export function getInventory(data: WorkbookData): InventoryRow[] {
  const inventory = new Map<string, InventoryRow>(
    data.Variants.map(({ id }) => [
      id,
      { variantId: id, onHand: 0, reserved: 0, unavailable: 0, available: 0 },
    ]),
  );
  const orders = new Map(data.Orders.map((order) => [order.id, order]));
  const items = new Map(data['Order Items'].map((item) => [item.id, item]));

  for (const entry of data['Stock Entries']) {
    const stock = inventory.get(entry.variantId);
    if (stock) {
      stock.onHand += entry.onHandDelta;
      stock.unavailable += entry.unavailableDelta;
    }
  }

  for (const item of data['Order Items']) {
    const order = orders.get(item.orderId);
    const stock = inventory.get(item.variantId);
    if (!order || !stock) continue;
    if (order.status === 'In progress') stock.reserved += item.quantity;
    if (isShipped(order.status)) stock.onHand -= item.quantity;
  }

  for (const itemReturn of data.Returns) {
    const item = items.get(itemReturn.orderItemId);
    const stock = item && inventory.get(item.variantId);
    if (!stock || itemReturn.status !== 'Received') continue;
    if (itemReturn.condition !== 'Sellable' && itemReturn.condition !== 'Damaged') continue;
    stock.onHand += itemReturn.quantity;
    if (itemReturn.condition === 'Damaged') stock.unavailable += itemReturn.quantity;
  }

  return Array.from(inventory.values(), (stock) => ({
    ...stock,
    available: stock.onHand - stock.reserved - stock.unavailable,
  }));
}

export function applyChanges(data: WorkbookData, changes: RowChange[]): WorkbookData {
  const result = { ...data };
  for (const { tab, row } of changes) {
    const rows: TableRows[TableName][] = result[tab];
    const index = rows.findIndex((existing) => existing.id === row.id);
    const updated = rows.slice();
    if (index === -1) updated.push(row);
    else updated[index] = row;
    Object.assign(result, { [tab]: updated });
  }
  return result;
}

export function validateChanges(data: WorkbookData, changes: RowChange[]) {
  const next = applyChanges(data, changes);
  const inventory = new Map(getInventory(next).map((stock) => [stock.variantId, stock]));
  for (const change of changes) {
    if (change.tab === 'Settings') {
      if (change.row.id === 'currency' && !/^[A-Z]{3}$/.test(change.row.value))
        throw new Error('Enter a three-letter currency code, such as USD or BDT.');
      if (change.row.id === 'shippingOptions') parseShippingOptions(change.row.value);
    }
    if (change.tab === 'Customers' && !change.row.name.trim()) throw new Error('Enter a customer name.');
    if (change.tab === 'Orders') {
      const order = change.row;
      if (!PAYMENT_STATUSES.includes(order.paymentStatus)) throw new Error('Choose a valid payment status.');
      if (order.customerId && !next.Customers.some((customer) => customer.id === order.customerId))
        throw new Error('Choose an existing customer.');
      const previous = data.Orders.find((row) => row.id === order.id);
      if (!order.customer.trim()) throw new Error('Enter a customer name.');
      const items = next['Order Items'].filter((item) => item.orderId === order.id);
      if (!items.length) throw new Error('Add at least one item to the order.');
      const subtotal = orderSubtotal(items);
      if (
        !Number.isFinite(order.discount) ||
        order.discount < 0 ||
        order.discount > subtotal ||
        !Number.isFinite(order.shippingCharge) ||
        order.shippingCharge < 0
      ) {
        throw new Error(
          'Use a nonnegative shipping charge and a discount between zero and the order subtotal.',
        );
      }
      if (!previous && order.status !== 'Draft') throw new Error('New orders must start as drafts.');
      if (previous && previous.status !== order.status) {
        if (!NEXT_STATUSES[previous.status].includes(order.status)) {
          throw new Error(
            `Order ${order.number} is now ${previous.status}. Refresh and choose a valid action.`,
          );
        }
        if (order.status === 'In progress' || order.status === 'Shipped') {
          for (const { variantId, sku } of items) {
            const stock = inventory.get(variantId);
            if (!stock || stock.available < 0)
              throw new Error(`There is insufficient available stock for ${sku}.`);
          }
        }
      }
    }
    if (change.tab === 'Order Items') {
      const item = change.row;
      if (
        !next.Variants.some((variant) => variant.id === item.variantId) ||
        !next.Orders.some((order) => order.id === item.orderId)
      ) {
        throw new Error('The order item must reference an existing order and variant.');
      }
      if (
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0
      ) {
        throw new Error('Order quantities must be positive whole numbers and prices must be nonnegative.');
      }
    }
    if (change.tab === 'Returns') {
      const itemReturn = change.row;
      const item = next['Order Items'].find((row) => row.id === itemReturn.orderItemId);
      const order = item && next.Orders.find((row) => row.id === item.orderId);
      if (!item || !order || !isShipped(order.status))
        throw new Error('Returns require a shipped order item.');
      if (!Number.isSafeInteger(itemReturn.quantity) || itemReturn.quantity <= 0)
        throw new Error('Enter a positive whole return quantity.');
      if (!RETURN_STATUSES.includes(itemReturn.status)) throw new Error('Choose a valid return status.');
      if (itemReturn.status === 'Requested' && (itemReturn.condition || itemReturn.receivedAt))
        throw new Error('Record the condition and date when the return is received.');
      if (
        itemReturn.status === 'Received' &&
        (!itemReturn.condition ||
          !RETURN_CONDITIONS.includes(itemReturn.condition) ||
          !Number.isFinite(Date.parse(itemReturn.receivedAt)))
      ) {
        throw new Error('Record the condition and date for the received return.');
      }
      const alreadyReceived = data.Returns.find((row) => row.id === itemReturn.id)?.status === 'Received';
      if (alreadyReceived) throw new Error('This return has already been received.');
      const total = next.Returns.filter((row) => row.orderItemId === item.id).reduce(
        (sum, row) => sum + row.quantity,
        0,
      );
      if (total > item.quantity) throw new Error('The return quantity exceeds the quantity shipped.');
    }
    if (change.tab === 'Products') {
      if (!change.row.name.trim()) throw new Error('Enter a product name.');
      const previousImage = data.Products.find((product) => product.id === change.row.id)?.image;
      if (change.row.image !== previousImage && (change.row.image?.length ?? 0) > MAX_PRODUCT_IMAGE_LENGTH) {
        throw new Error('This picture is too large to save in the product sheet. Choose a smaller picture.');
      }
    }
    if (change.tab === 'Categories') {
      if (!change.row.name.trim()) throw new Error('Enter a category name.');
      const seen = new Set([change.row.id]);
      let parentId = change.row.parentId;
      while (parentId) {
        if (seen.has(parentId))
          throw new Error('A category cannot be its own parent or a descendant of itself.');
        seen.add(parentId);
        const parent = next.Categories.find((row) => row.id === parentId);
        if (!parent) throw new Error('Select an existing parent category.');
        parentId = parent.parentId;
      }
    }
    if (change.tab === 'Variants') {
      const variant = change.row;
      if (!next.Products.some((product) => product.id === variant.productId))
        throw new Error('Select an existing product.');
      if (!variant.sku.trim()) throw new Error('Enter a SKU.');
      if (
        next.Variants.some(
          (row) => row.id !== variant.id && row.sku.trim().toLowerCase() === variant.sku.trim().toLowerCase(),
        )
      ) {
        throw new Error(`SKU ${variant.sku} already exists.`);
      }
      if (!Number.isFinite(variant.price) || variant.price < 0) throw new Error('Enter a nonnegative price.');
    }
    if (change.tab === 'Purchase Lots') {
      const lot = change.row;
      if (!lot.name.trim()) throw new Error('Enter a purchase lot name.');
      if (!Number.isFinite(lot.totalAmount) || lot.totalAmount < 0)
        throw new Error('Enter a nonnegative purchase amount.');
      if (!Number.isSafeInteger(lot.totalUnits) || lot.totalUnits <= 0)
        throw new Error('Enter a positive whole number of purchased units.');
    }
    if (change.tab === 'Stock Entries') {
      const entry = change.row;
      if (entry.purchaseLotId && !next['Purchase Lots'].some((lot) => lot.id === entry.purchaseLotId))
        throw new Error('Choose an existing purchase lot.');
      const stock = inventory.get(entry.variantId);
      if (!Number.isSafeInteger(entry.onHandDelta) || !Number.isSafeInteger(entry.unavailableDelta))
        throw new Error('Stock changes must be whole units.');
      if (!stock || stock.onHand < 0 || stock.unavailable < 0 || stock.unavailable > stock.onHand) {
        throw new Error('The adjustment would make on-hand or unavailable stock inconsistent.');
      }
    }
  }
}

export function getInventoryIssues(data: WorkbookData, inventory: InventoryRow[]) {
  const issues: string[] = [];
  for (const row of inventory) {
    if (row.available < 0 || row.unavailable < 0) {
      const sku = data.Variants.find((variant) => variant.id === row.variantId)?.sku || row.variantId;
      issues.push(`Check the stock balance for ${sku}.`);
    }
  }

  const orders = new Map(data.Orders.map((order) => [order.id, order]));
  const items = new Map(data['Order Items'].map((item) => [item.id, item]));
  const returnQuantities = new Map<string, number>();
  for (const itemReturn of data.Returns) {
    const item = items.get(itemReturn.orderItemId);
    const order = item && orders.get(item.orderId);
    if (!item || !order || !isShipped(order.status)) {
      issues.push(`Return ${itemReturn.id} references an item without a shipped order.`);
    }
    returnQuantities.set(
      itemReturn.orderItemId,
      (returnQuantities.get(itemReturn.orderItemId) ?? 0) + itemReturn.quantity,
    );
  }
  const variants = new Set(data.Variants.map((variant) => variant.id));
  for (const item of data['Order Items']) {
    if (!orders.has(item.orderId) || !variants.has(item.variantId)) {
      issues.push(`Order item ${item.id} references a missing order or variant.`);
    }
    if ((returnQuantities.get(item.id) ?? 0) > item.quantity) {
      issues.push(
        `Returns for ${item.sku} exceed the quantity on order ${orders.get(item.orderId)?.number ?? item.orderId}.`,
      );
    }
  }
  return issues;
}

export function customerDirectory(
  data: WorkbookData,
): { key: string; customer: Customer; orders: Order[]; saved: boolean }[] {
  const entries = data.Customers.map((customer) => ({
    key: customer.id,
    customer,
    orders: data.Orders.filter((order) => order.customerId === customer.id),
    saved: true,
  }));
  // Unlinked historical orders are suggestions, not silently merged customer records.
  const historical = new Map<string, (typeof entries)[number]>();
  for (const order of data.Orders) {
    if (order.customerId) continue;
    const identity = JSON.stringify([order.customer.trim(), order.contact.trim(), order.address.trim()]);
    let entry = historical.get(identity);
    if (!entry) {
      entry = {
        key: `order:${order.id}`,
        customer: {
          id: '',
          name: order.customer,
          contact: order.contact,
          address: order.address,
          notes: '',
          active: true,
        },
        orders: [],
        saved: false,
      };
      historical.set(identity, entry);
    }
    entry.orders.push(order);
  }
  return [...entries, ...historical.values()];
}

export function categoryPath(categories: Category[], id: string): Category[] {
  const path: Category[] = [];
  const seen = new Set<string>();
  let current = categories.find((row) => row.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = categories.find((row) => row.id === current!.parentId);
  }
  return path;
}

export function purchaseLotSummary(data: WorkbookData, lotId: string) {
  const products = new Map<string, { productId: string; name: string; units: number }>();
  for (const entry of data['Stock Entries']) {
    if (entry.purchaseLotId !== lotId) continue;
    const variant = data.Variants.find((row) => row.id === entry.variantId);
    const productId = variant?.productId ?? entry.variantId;
    const product = products.get(productId) ?? {
      productId,
      name: data.Products.find((row) => row.id === productId)?.name ?? 'Unknown product',
      units: 0,
    };
    product.units += entry.onHandDelta;
    products.set(productId, product);
  }
  return {
    units: [...products.values()].reduce((sum, product) => sum + product.units, 0),
    products: [...products.values()],
  };
}

type ShippingOption = { id: string; name: string; rate: number };

function parseShippingOptions(value: string): ShippingOption[] {
  let options: unknown;
  try {
    options = JSON.parse(value);
  } catch {
    throw new Error('Shipping options must be a valid list.');
  }
  if (!Array.isArray(options)) throw new Error('Shipping options must be a valid list.');
  const ids = new Set<string>();
  for (const option of options) {
    if (
      !option ||
      typeof option.id !== 'string' ||
      !option.id ||
      ids.has(option.id) ||
      typeof option.name !== 'string' ||
      !option.name.trim() ||
      typeof option.rate !== 'number' ||
      !Number.isFinite(option.rate) ||
      option.rate < 0
    ) {
      throw new Error('Give every shipping option a name and a nonnegative rate.');
    }
    ids.add(option.id);
  }
  return options;
}

export function getShippingOptions(data: WorkbookData): ShippingOption[] {
  const value = data.Settings.find((row) => row.id === 'shippingOptions')?.value;
  return value ? parseShippingOptions(value) : [];
}

export type Workbook = {
  id: string;
  title: string;
  data: WorkbookData;
};
