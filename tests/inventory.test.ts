import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyChanges,
  emptyWorkbook,
  getInventory,
  validateChanges,
  type OrderStatus,
  type WorkbookData,
} from '../src/domain/workbook.ts';

function fixture(status: OrderStatus): WorkbookData {
  return {
    ...emptyWorkbook(),
    Products: [{ id: 'p1', name: 'Tote', categoryId: '', description: '', optionNames: '', active: true }],
    Variants: [{ id: 'v1', productId: 'p1', sku: 'TOTE', optionValues: '', price: 20, active: true }],
    Orders: [
      {
        id: 'o1',
        number: 'ORD-1',
        createdAt: '',
        customer: 'Sam',
        contact: '',
        address: '',
        status,
        paymentStatus: 'Unpaid',
        notes: '',
        discount: 0,
        shippingCharge: 0,
      },
    ],
    'Order Items': [
      {
        id: 'l1',
        orderId: 'o1',
        variantId: 'v1',
        productName: 'Tote',
        variantName: 'Default',
        sku: 'TOTE',
        quantity: 2,
        unitPrice: 20,
      },
      {
        id: 'l2',
        orderId: 'o1',
        variantId: 'v1',
        productName: 'Tote',
        variantName: 'Default',
        sku: 'TOTE',
        quantity: 1,
        unitPrice: 20,
      },
    ],
    'Stock Entries': [
      {
        id: 's1',
        variantId: 'v1',
        date: '',
        type: 'Opening stock',
        onHandDelta: 10,
        unavailableDelta: 0,
        notes: '',
      },
    ],
  };
}

test('a fresh snapshot of a sheet status drives the full stock calculation', () => {
  const expected = {
    Draft: [10, 0, 10],
    'In progress': [10, 3, 7],
    Shipped: [7, 0, 7],
    Completed: [7, 0, 7],
    Cancelled: [10, 0, 10],
  } as const;

  for (const status of Object.keys(expected) as OrderStatus[]) {
    const data = fixture(status);
    const [stock] = getInventory(data);
    assert.deepEqual([stock.onHand, stock.reserved, stock.available], expected[status], status);
    assert.deepEqual(getInventory(data), [stock], 'refreshing never applies an additional deduction');
  }
});

test('a damaged return restores physical stock without increasing available stock', () => {
  const data = fixture('Completed');
  data.Returns = [
    {
      id: 'r1',
      orderItemId: 'l1',
      quantity: 1,
      status: 'Received',
      condition: 'Damaged',
      receivedAt: '2026-11-17',
      notes: '',
    },
    {
      id: 'r2',
      orderItemId: 'l1',
      quantity: 1,
      status: 'Requested',
      condition: '',
      receivedAt: '',
      notes: '',
    },
  ];
  assert.deepEqual(getInventory(data)[0], {
    variantId: 'v1',
    onHand: 8,
    reserved: 0,
    unavailable: 1,
    available: 7,
  });
  data.Returns[1] = {
    ...data.Returns[1],
    status: 'Received',
    condition: 'Sellable',
    receivedAt: '2026-11-17',
  };
  assert.deepEqual(getInventory(data)[0], {
    variantId: 'v1',
    onHand: 9,
    reserved: 0,
    unavailable: 1,
    available: 8,
  });
});

test('app confirmation uses all lines for a SKU and rejects shortages', () => {
  const data = fixture('Draft');
  const confirm = { tab: 'Orders', row: { ...data.Orders[0], status: 'In progress' } } as const;
  validateChanges(data, [confirm]);
  assert.equal(getInventory(applyChanges(data, [confirm]))[0].reserved, 3);
  data['Stock Entries'][0].onHandDelta = 2;
  assert.throws(() => validateChanges(data, [confirm]), /insufficient available stock/);
});

test('payment and return edits reject values the workbook cannot record', () => {
  const data = fixture('Shipped');
  const order = data.Orders[0];
  assert.throws(
    () =>
      validateChanges(data, [
        { tab: 'Orders', row: { ...order, paymentStatus: '' as typeof order.paymentStatus } },
      ]),
    /payment status/,
  );
  const receipt = {
    id: 'r1',
    orderItemId: 'l1',
    quantity: 1,
    status: 'Received',
    condition: 'Damaged',
    receivedAt: '2026-11-19',
    notes: '',
  } as const;
  validateChanges(data, [{ tab: 'Returns', row: receipt }]);
  for (const invalid of [
    { ...receipt, status: 'Invalid' },
    { ...receipt, status: 'Requested' },
    { ...receipt, condition: 'Unknown' },
    { ...receipt, receivedAt: 'invalid' },
  ]) {
    assert.throws(
      () => validateChanges(data, [{ tab: 'Returns', row: invalid as typeof receipt }]),
      /return|condition/i,
    );
  }
});

test('partial payments and refunds require an amount strictly inside the order total', () => {
  const data = fixture('Shipped');
  for (const paymentStatus of ['Partially paid', 'Partially refunded'] as const) {
    const save = (partialAmount?: number) =>
      validateChanges(data, [{ tab: 'Orders', row: { ...data.Orders[0], paymentStatus, partialAmount } }]);
    for (const amount of [undefined, NaN, 0, -1, 60, 70]) assert.throws(() => save(amount), /partial amount/);
    assert.doesNotThrow(() => save(15));
  }
});
