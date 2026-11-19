import { getInventory, isShipped, ORDER_STATUSES, type WorkbookData } from './workbook.ts';
import { lineSubtotal, orderTotal } from './order-totals.ts';

export function dashboardSummary(data: WorkbookData, days: number, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const trend = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      day: dayKey(date),
      value: 0,
      orders: 0,
      sales: 0,
      cost: 0 as number | null,
      costedValue: 0,
      costedUnits: 0,
      uncostedUnits: 0,
    };
  });
  const byDay = new Map(trend.map((day) => [day.day, day]));
  const orders = data.Orders.filter((order) => {
    const date = new Date(order.createdAt);
    return date >= start && date < end;
  });
  const subtotals = new Map<string, number>();
  for (const item of data['Order Items'])
    subtotals.set(
      item.orderId,
      (subtotals.get(item.orderId) ?? 0) + lineSubtotal(item.quantity, item.unitPrice),
    );
  const totalForOrder = (order: (typeof orders)[number]) => orderTotal(subtotals.get(order.id) ?? 0, order);
  const sales = orders.filter(
    (order) =>
      (order.status === 'In progress' || isShipped(order.status)) && order.paymentStatus !== 'Refunded',
  );
  const saleIds = new Set(sales.map((order) => order.id));
  let value = 0;
  for (const order of orders) {
    const day = byDay.get(dayKey(new Date(order.createdAt)))!;
    day.orders++;
    if (saleIds.has(order.id)) {
      const total = totalForOrder(order);
      day.value += total;
      day.sales++;
      value += total;
    }
  }
  const variants = new Map(data.Variants.map((variant) => [variant.id, variant]));
  const productNames = new Map(data.Products.map((product) => [product.id, product.name]));
  const saleOrders = new Map(sales.map((order) => [order.id, order]));
  const orderUnits = new Map<string, number>();
  for (const item of data['Order Items'])
    orderUnits.set(item.orderId, (orderUnits.get(item.orderId) ?? 0) + item.quantity);
  const lots = new Map(data['Purchase Lots'].map((lot) => [lot.id, lot]));
  const receipts = new Map<string, { date: number; units: number; cost: number }[]>();
  for (const entry of data['Stock Entries']) {
    if ((entry.type !== 'Opening stock' && entry.type !== 'Receipt') || entry.onHandDelta <= 0) continue;
    const lot = entry.purchaseLotId && lots.get(entry.purchaseLotId);
    if (!lot || lot.totalUnits <= 0) continue;
    const rows = receipts.get(entry.variantId) ?? [];
    rows.push({
      date: new Date(entry.date).getTime(),
      units: entry.onHandDelta,
      cost: lot.totalAmount / lot.totalUnits,
    });
    receipts.set(entry.variantId, rows);
  }
  const products = new Map<string, { id: string; name: string; units: number }>();
  for (const item of data['Order Items']) {
    const order = saleOrders.get(item.orderId);
    if (!order) continue;
    const saleDate = new Date(order.createdAt);
    const day = byDay.get(dayKey(saleDate))!;
    const purchased = (receipts.get(item.variantId) ?? []).filter(
      (receipt) => receipt.date <= saleDate.getTime(),
    );
    const units = purchased.reduce((sum, receipt) => sum + receipt.units, 0);
    if (units) {
      const subtotal = subtotals.get(order.id)!;
      const share = subtotal
        ? lineSubtotal(item.quantity, item.unitPrice) / subtotal
        : item.quantity / orderUnits.get(order.id)!;
      day.costedValue += totalForOrder(order) * share;
      day.costedUnits += item.quantity;
      day.cost =
        (day.cost ?? 0) +
        (item.quantity * purchased.reduce((sum, receipt) => sum + receipt.units * receipt.cost, 0)) / units;
    } else {
      if (!day.costedUnits) day.cost = null;
      day.uncostedUnits += item.quantity;
    }
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
    sales: sales.length,
    average: sales.length ? value / sales.length : 0,
    unpaid: orders
      .filter(
        (order) =>
          order.paymentStatus === 'Unpaid' && (order.status === 'In progress' || isShipped(order.status)),
      )
      .reduce((sum, order) => sum + totalForOrder(order), 0),
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

export function dashboardOrderDays(data: WorkbookData) {
  return [
    ...new Set(
      data.Orders.map((order) => new Date(order.createdAt))
        .filter((date) => Number.isFinite(date.getTime()))
        .map(dayKey),
    ),
  ].sort();
}

export function dashboardDateRange(start: string, end: string, availableDays: string[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return;
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    dayKey(from) !== start ||
    dayKey(to) !== end
  )
    return;
  if (!availableDays.some((day) => day >= start && day <= end)) return;
  // Count calendar days independently of local daylight-saving changes.
  return { days: Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1, end: to };
}

export function dashboardPresetRange(days: number, now = new Date()) {
  return {
    start: dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)),
    end: dayKey(now),
  };
}
