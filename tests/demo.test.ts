import assert from 'node:assert/strict';
import test from 'node:test';
import { demoWorkbook } from '../src/domain/demo.ts';
import { getInventory, getInventoryIssues, isShipped, purchaseLotSummary } from '../src/domain/workbook.ts';

const now = new Date('2026-11-18T12:00:00Z');

test('demo supplies a repeatable year of USD orders and a large image-free catalog', () => {
  const data = demoWorkbook(now);
  assert.deepEqual(data, demoWorkbook(now));
  assert.equal(data.Settings.find((row) => row.id === 'currency')?.value, 'USD');
  assert.ok(data.Products.length >= 100);
  assert.ok(data.Products.every((row) => !row.image));
  assert.equal(new Set(data.Variants.map((row) => row.sku)).size, data.Variants.length);
  assert.ok(data.Orders.length > 1200 && data.Orders.length < 2500);
  const dates = data.Orders.map((row) => Date.parse(row.createdAt));
  assert.ok(Math.max(...dates) <= now.getTime());
  assert.ok(Math.max(...dates) - Math.min(...dates) >= 363 * 86400000);
  const customers = new Map(data.Customers.map((row) => [row.id, row]));
  for (const order of data.Orders) {
    assert.equal(order.customer, customers.get(order.customerId!)?.name);
    const items = data['Order Items'].filter((row) => row.orderId === order.id);
    assert.ok(items.length > 0);
    assert.ok(order.discount <= items.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0));
  }
  assert.ok(data.Orders.filter((row) => row.status === 'Completed').length > data.Orders.length * 0.85);
  for (const status of ['Draft', 'In progress', 'Shipped'] as const) {
    const orders = data.Orders.filter((row) => row.status === status);
    assert.ok(orders.length > 0);
    assert.ok(orders.every((row) => now.getTime() - Date.parse(row.createdAt) < 8 * 86400000));
  }
});

test('Eid shopping builds before both Bangladesh holidays and slows during the holidays', () => {
  const data = demoWorkbook(now);
  const count = (start: string, end: string) =>
    data.Orders.filter((row) => row.createdAt >= start && row.createdAt < end).length;
  const baseline = count('2026-01-01', '2026-02-01') / 31;
  for (const [start, cutoff, end] of [
    ['2026-03-01', '2026-03-19', '2026-03-26'],
    ['2026-05-08', '2026-05-26', '2026-06-02'],
  ]) {
    const before = count(start, cutoff) / 18;
    const during = count(cutoff, end) / 7;
    assert.ok(before > baseline * 2);
    assert.ok(during < baseline * 0.5);
  }
});

test('purchase lots reconcile and chronological stock covers fulfilled and reserved orders', () => {
  const data = demoWorkbook(now);
  assert.deepEqual(getInventoryIssues(data, getInventory(data)), []);
  assert.ok(data['Purchase Lots'].length > 20);
  for (const lot of data['Purchase Lots']) {
    assert.equal(purchaseLotSummary(data, lot.id).units, lot.totalUnits);
    assert.ok(lot.totalAmount > 0);
  }
  const orders = new Map(data.Orders.map((row) => [row.id, row]));
  const events = data['Stock Entries'].map((row) => ({
    date: row.date,
    variantId: row.variantId,
    delta: row.onHandDelta - row.unavailableDelta,
    priority: 0,
  }));
  for (const item of data['Order Items']) {
    const order = orders.get(item.orderId)!;
    if (isShipped(order.status) || order.status === 'In progress')
      events.push({ date: order.createdAt, variantId: item.variantId, delta: -item.quantity, priority: 1 });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);
  const balances = new Map<string, number>();
  for (const event of events) {
    assert.ok(Date.parse(event.date) <= now.getTime());
    const balance = (balances.get(event.variantId) ?? 0) + event.delta;
    assert.ok(balance >= 0, `${event.variantId} has negative stock at ${event.date}`);
    balances.set(event.variantId, balance);
  }
  for (const stock of getInventory(data)) assert.equal(stock.available, balances.get(stock.variantId));
});
