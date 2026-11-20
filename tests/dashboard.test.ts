import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dashboardDateRange,
  dashboardOrderDays,
  dashboardPresetRange,
  dashboardSummary,
} from '../src/domain/dashboard.ts';
import * as model from '../src/domain/workbook.ts';

test('dashboard counts confirmed sales separately from unpaid balances, refunds and other order states', () => {
  const data = model.emptyWorkbook();
  const now = new Date(2026, 10, 18, 12);
  data.Orders = ['Draft', 'In progress', 'Shipped', 'Completed', 'Cancelled', 'Completed'].map(
    (status, i) => ({
      id: String(i),
      number: String(i),
      createdAt: now.toISOString(),
      customer: 'Test',
      contact: '',
      address: '',
      notes: '',
      status: status as model.OrderStatus,
      paymentStatus: i === 5 ? 'Refunded' : i === 3 ? 'Paid' : 'Unpaid',
      discount: 5,
      shippingCharge: 2,
    }),
  );
  data['Order Items'] = data.Orders.map((order) => ({
    id: order.id,
    orderId: order.id,
    variantId: 'v',
    productName: 'Product',
    variantName: '',
    sku: 'SKU',
    quantity: 2,
    unitPrice: 10,
  }));
  const result = dashboardSummary(data, 7, now);
  assert.equal(result.orders, 6);
  assert.equal(result.sales, 3);
  assert.equal(result.value, 51);
  assert.equal(result.average, 17);
  assert.equal(result.trend.at(-1).sales, 3);
  assert.equal(result.unpaid, 34);
  Object.assign(data.Orders[1], { paymentStatus: 'Partially paid', partialAmount: 4 });
  Object.assign(data.Orders[3], { paymentStatus: 'Partially refunded', partialAmount: 6 });
  const partial = dashboardSummary(data, 7, now);
  assert.equal(partial.unpaid, 30);
  assert.equal(partial.value, 45);
  assert.equal(partial.trend.at(-1).value, 45);
  assert.equal(result.products[0].units, 6);
  assert.equal(result.trend.at(-1).value, 51);
  assert.equal(
    result.statuses.reduce((sum: number, entry: any) => sum + entry.count, 0),
    6,
  );
});

test('dashboard date boundaries include today, exclude future/old dates and fill empty days', () => {
  const data = model.emptyWorkbook();
  const now = new Date(2026, 10, 18, 12);
  data.Orders = [
    new Date(2026, 10, 12),
    new Date(2026, 10, 11, 23, 59),
    new Date(2026, 10, 18, 23, 59),
    new Date(2026, 10, 19),
  ].map((date, i) => ({
    id: String(i),
    number: String(i),
    createdAt: date.toISOString(),
    customer: 'Test',
    contact: '',
    address: '',
    notes: '',
    status: 'Draft',
    paymentStatus: 'Unpaid',
    discount: 0,
    shippingCharge: 0,
  }));
  const result = dashboardSummary(data, 7, now);
  assert.equal(result.orders, 2);
  assert.equal(result.trend.length, 7);
  assert.equal(result.trend[0].orders, 1);
  assert.equal(result.trend[1].orders, 0);
  assert.equal(result.trend[6].orders, 1);
  assert.equal(result.average, 0);
  assert.equal(dashboardSummary(model.emptyWorkbook(), 30, now).value, 0);
});

test('inventory metrics stay current across periods and low stock excludes archived products', () => {
  const data = model.emptyWorkbook();
  data.Products = [
    { id: 'p', name: 'Product', categoryId: '', description: '', optionNames: '', active: true },
    { id: 'archived', name: 'Archived', categoryId: '', description: '', optionNames: '', active: false },
  ];
  data.Variants = [
    { id: 'v', productId: 'p', sku: 'SKU', optionValues: '', price: 10, active: true },
    { id: 'a', productId: 'archived', sku: 'OLD', optionValues: '', price: 10, active: true },
  ];
  data['Stock Entries'] = [
    {
      id: 's',
      variantId: 'v',
      date: '2020-01-01',
      type: 'Opening stock',
      onHandDelta: 5,
      unavailableDelta: 1,
      notes: '',
    },
  ];
  const result = dashboardSummary(data, 7);
  assert.equal(result.stock.onHand, 5);
  assert.equal(result.stock.available, 4);
  assert.equal(result.lowStock.length, 1);
  assert.equal(result.lowStock[0].sku, 'SKU');
});

test('single-day summary isolates a selected historical local day including its boundaries', () => {
  const data = model.emptyWorkbook();
  const dates = [
    new Date(2026, 10, 11, 23, 59),
    new Date(2026, 10, 12),
    new Date(2026, 10, 12, 23, 59),
    new Date(2026, 10, 13),
  ];
  data.Orders = dates.map((date, i) => ({
    id: String(i),
    number: String(i),
    createdAt: date.toISOString(),
    customer: 'Test',
    contact: '',
    address: '',
    notes: '',
    status: 'Completed',
    paymentStatus: 'Unpaid',
    discount: 2,
    shippingCharge: 5,
  }));
  data['Order Items'] = data.Orders.map((order) => ({
    id: order.id,
    orderId: order.id,
    variantId: 'v',
    productName: 'Product',
    variantName: '',
    sku: 'SKU',
    quantity: 2,
    unitPrice: 10,
  }));
  const result = dashboardSummary(data, 1, new Date(2026, 10, 12, 12));
  assert.equal(result.trend.length, 1);
  assert.equal(result.trend[0].day, '2026-11-12');
  assert.equal(result.orders, 2);
  assert.equal(result.sales, 2);
  assert.equal(result.value, 46);
  assert.equal(result.average, 23);
  assert.equal(result.unpaid, 46);
});

test('sales costs weight earlier purchase receipts by units and leave unknown costs as gaps', () => {
  const data = model.emptyWorkbook();
  data['Purchase Lots'] = [
    { id: 'a', name: 'Opening', totalAmount: 100, totalUnits: 10 },
    { id: 'b', name: 'Restock', totalAmount: 600, totalUnits: 30 },
    { id: 'future', name: 'Later', totalAmount: 1000, totalUnits: 10 },
    { id: 'free', name: 'Samples', totalAmount: 0, totalUnits: 5 },
  ];
  data['Stock Entries'] = [
    ['a', 'v', 10, '2026-11-01', 'Opening stock'],
    ['b', 'v', 30, '2026-11-10', 'Receipt'],
    ['future', 'v', 10, '2026-11-19', 'Receipt'],
    ['future', 'v', 10, '2026-11-10', 'Adjustment'],
    ['free', 'free', 5, '2026-11-01', 'Receipt'],
  ].map(([lot, variantId, units, date, type], i) => ({
    id: String(i),
    purchaseLotId: String(lot),
    variantId: String(variantId),
    date: new Date(`${date}T00:00:00`).toISOString(),
    type: type as model.StockType,
    onHandDelta: Number(units),
    unavailableDelta: 0,
    notes: '',
  }));
  data.Orders = [
    'In progress',
    'Shipped',
    'Completed',
    'Draft',
    'Cancelled',
    'Completed',
    'Completed',
    'Completed',
  ].map((status, i) => ({
    id: String(i),
    number: String(i),
    createdAt: new Date(2026, 10, i === 6 ? 17 : 18, 12).toISOString(),
    customer: 'Test',
    contact: '',
    address: '',
    notes: '',
    status: status as model.OrderStatus,
    paymentStatus: i === 5 ? 'Refunded' : 'Paid',
    discount: 0,
    shippingCharge: 5,
  }));
  data['Order Items'] = data.Orders.map((order, i) => ({
    id: order.id,
    orderId: order.id,
    variantId: i === 6 ? 'unknown' : i === 7 ? 'free' : 'v',
    productName: 'Test',
    variantName: '',
    sku: 'TEST',
    quantity: 2,
    unitPrice: 30,
  }));
  data['Order Items'].push({ ...data['Order Items'][0], id: 'unmatched', variantId: 'unknown' });
  const result = dashboardSummary(data, 7, new Date(2026, 10, 18, 12));
  // (10 × $10 + 30 × $20) / 40 × 6 sold units; no future purchases or adjustments.
  assert.equal(result.trend.at(-1).cost, 105);
  assert.equal(result.trend.at(-1).uncostedUnits, 2);
  assert.equal(result.trend.at(-1).costedUnits, 8);
  assert.equal(result.trend.at(-1).costedValue, 62.5 + 3 * 65);
  assert.equal(result.trend.at(-2).cost, null);
  assert.equal(result.trend.at(-2).uncostedUnits, 2);
  assert.equal(result.trend[0].cost, 0);
});

test('date ranges use available order dates and reject empty or invalid selections', () => {
  const data = model.emptyWorkbook();
  const base = {
    id: 'a',
    number: 'A',
    customer: 'Test',
    contact: '',
    address: '',
    notes: '',
    status: 'Draft' as const,
    paymentStatus: 'Unpaid' as const,
    discount: 0,
    shippingCharge: 0,
  };
  data.Orders = ['2026-03-07T12:00:00', '2026-03-09T12:00:00', '2026-03-09T15:00:00', 'invalid'].map(
    (date, i) => ({ ...base, id: String(i), createdAt: date }),
  );
  const available = dashboardOrderDays(data);
  assert.equal(available.join(','), '2026-03-07,2026-03-09');
  assert.equal(dashboardDateRange('2026-03-07', '2026-03-09', available).days, 3);
  assert.equal(dashboardDateRange('2026-03-09', '2026-03-09', available).days, 1);
  assert.equal(dashboardDateRange('2026-03-08', '2026-03-08', available), undefined);
  assert.equal(dashboardDateRange('2026-03-09', '2026-03-07', available), undefined);
  assert.equal(dashboardDateRange('2026-02-30', '2026-03-09', available), undefined);
  assert.equal(dashboardDateRange('', '2026-03-09', available), undefined);
  assert.equal(dashboardDateRange('2026-03-07', '2026-03-09', []), undefined);
  const preset = dashboardPresetRange(7, new Date(2026, 2, 9));
  assert.equal(preset.start, '2026-03-03');
  assert.equal(preset.end, '2026-03-09');
});
