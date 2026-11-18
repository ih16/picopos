import { getInventory, isShipped, ORDER_STATUSES, type WorkbookData } from './workbook';

export function dashboardSummary(data: WorkbookData, days: number, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const trend = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { day: dayKey(date), value: 0, orders: 0 };
  });
  const byDay = new Map(trend.map((day) => [day.day, day]));
  const orders = data.Orders.filter((order) => {
    const date = new Date(order.createdAt);
    return date >= start && date < end;
  });
  const subtotals = new Map<string, number>();
  for (const item of data['Order Items'])
    subtotals.set(item.orderId, (subtotals.get(item.orderId) ?? 0) + item.quantity * item.unitPrice);
  const orderTotal = (order: (typeof orders)[number]) =>
    (subtotals.get(order.id) ?? 0) - order.discount + order.shippingCharge;
  const fulfilled = orders.filter((order) => isShipped(order.status) && order.paymentStatus !== 'Refunded');
  const fulfilledIds = new Set(fulfilled.map((order) => order.id));
  let value = 0;
  for (const order of orders) {
    const day = byDay.get(dayKey(new Date(order.createdAt)))!;
    day.orders++;
    if (fulfilledIds.has(order.id)) {
      const total = orderTotal(order);
      day.value += total;
      value += total;
    }
  }
  const variants = new Map(data.Variants.map((variant) => [variant.id, variant]));
  const productNames = new Map(data.Products.map((product) => [product.id, product.name]));
  const products = new Map<string, { id: string; name: string; units: number }>();
  for (const item of data['Order Items']) {
    if (!fulfilledIds.has(item.orderId)) continue;
    const id = variants.get(item.variantId)?.productId ?? item.productName;
    const product = products.get(id) ?? { id, name: productNames.get(id) ?? item.productName, units: 0 };
    product.units += item.quantity;
    products.set(id, product);
  }
  const inventory = getInventory(data);
  const stock = inventory.reduce(
    (total, row) => ({
      onHand: total.onHand + row.onHand,
      reserved: total.reserved + row.reserved,
      unavailable: total.unavailable + row.unavailable,
      available: total.available + row.available,
    }),
    { onHand: 0, reserved: 0, unavailable: 0, available: 0 },
  );
  const activeProducts = new Set(
    data.Products.filter((product) => product.active).map((product) => product.id),
  );
  const lowStock = inventory
    .filter((row) => {
      const variant = variants.get(row.variantId);
      return variant?.active && activeProducts.has(variant.productId) && row.available <= 5;
    })
    .sort((a, b) => a.available - b.available)
    .map((row) => {
      const variant = variants.get(row.variantId)!;
      return { ...row, sku: variant.sku, name: productNames.get(variant.productId) ?? variant.sku };
    });
  return {
    orders: orders.length,
    value,
    fulfilled: fulfilled.length,
    average: fulfilled.length ? value / fulfilled.length : 0,
    unpaid: orders
      .filter(
        (order) =>
          order.paymentStatus === 'Unpaid' && (order.status === 'In progress' || isShipped(order.status)),
      )
      .reduce((sum, order) => sum + orderTotal(order), 0),
    statuses: ORDER_STATUSES.map((status) => ({
      status,
      count: orders.filter((order) => order.status === status).length,
    })),
    trend,
    products: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    stock,
    lowStock,
  };
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
