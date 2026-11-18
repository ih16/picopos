import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as model from '../src/domain/workbook.ts';

const exports: any = {};
const source = readFileSync(new URL('../src/domain/dashboard.ts', import.meta.url), 'utf8');
runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports, require: () => model, Date },
);
const { dashboardSummary } = exports;

test('dashboard separates fulfilled value, unpaid value, refunds and order states', () => {
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
  assert.equal(result.fulfilled, 2);
  assert.equal(result.value, 34);
  assert.equal(result.average, 17);
  assert.equal(result.unpaid, 34);
  assert.equal(result.products[0].units, 4);
  assert.equal(result.trend.at(-1).value, 34);
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
  assert.equal(result.fulfilled, 2);
  assert.equal(result.value, 46);
  assert.equal(result.average, 23);
  assert.equal(result.unpaid, 46);
});
