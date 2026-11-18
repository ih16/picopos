import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyChanges,
  emptyWorkbook,
  getInventory,
  purchaseLotSummary,
  validateChanges,
  type RowChange,
} from '../src/domain/workbook.ts';

function fixture() {
  const data = emptyWorkbook();
  data.Products = [{ id: 'p', name: 'Tote', categoryId: '', description: '', optionNames: '', active: true }];
  data.Variants = ['a', 'b'].map((id) => ({
    id,
    productId: 'p',
    sku: id,
    optionValues: id,
    price: 20,
    active: true,
  }));
  data['Purchase Lots'] = [
    { id: 'lot', name: 'First purchase', totalAmount: 100, totalUnits: 10 },
    { id: 'other', name: 'Second purchase', totalAmount: 20, totalUnits: 2 },
  ];
  data['Stock Entries'] = ['a', 'b'].map((id) => ({
    id,
    variantId: id,
    date: '',
    type: 'Receipt' as const,
    onHandDelta: 5,
    unavailableDelta: 0,
    notes: '',
    purchaseLotId: 'lot',
  }));
  return data;
}

test('lot counts group variants by product and remain independent of sales and damage', () => {
  const data = fixture();
  data.Orders = [
    {
      id: 'o',
      number: '1',
      createdAt: '',
      customer: 'Sam',
      contact: '',
      address: '',
      status: 'Completed',
      paymentStatus: 'Paid',
      notes: '',
      discount: 0,
      shippingCharge: 0,
    },
  ];
  data['Order Items'] = [
    {
      id: 'i',
      orderId: 'o',
      variantId: 'a',
      productName: 'Tote',
      variantName: '',
      sku: 'a',
      quantity: 2,
      unitPrice: 20,
    },
  ];
  data['Stock Entries'].push({
    id: 'damage',
    variantId: 'b',
    date: '',
    type: 'Damaged',
    onHandDelta: 0,
    unavailableDelta: 1,
    notes: '',
    purchaseLotId: 'lot',
  });
  assert.equal(getInventory(data)[0].onHand, 3);
  assert.deepEqual(purchaseLotSummary(data, 'lot'), {
    units: 10,
    products: [{ productId: 'p', name: 'Tote', units: 10 }],
  });
});

test('changing and clearing a lot link updates totals without changing inventory', () => {
  const data = fixture();
  for (const purchaseLotId of ['other', '']) {
    const changes: RowChange[] = [
      { tab: 'Stock Entries', row: { ...data['Stock Entries'][0], purchaseLotId } },
    ];
    validateChanges(data, changes);
    const next = applyChanges(data, changes);
    assert.equal(purchaseLotSummary(next, 'lot').units, 5);
    assert.equal(purchaseLotSummary(next, 'other').units, purchaseLotId ? 5 : 0);
    assert.deepEqual(getInventory(next), getInventory(data));
  }
});

test('purchase validation rejects invalid totals and missing links, but permits count mismatches', () => {
  const data = fixture();
  for (const patch of [
    { totalUnits: 0 },
    { totalUnits: 1.5 },
    { totalAmount: -1 },
    { totalAmount: NaN },
    { name: ' ' },
  ]) {
    assert.throws(() =>
      validateChanges(data, [{ tab: 'Purchase Lots', row: { ...data['Purchase Lots'][0], ...patch } }]),
    );
  }
  assert.throws(
    () =>
      validateChanges(data, [
        { tab: 'Stock Entries', row: { ...data['Stock Entries'][0], purchaseLotId: 'missing' } },
      ]),
    /existing purchase lot/,
  );
  assert.doesNotThrow(() =>
    validateChanges(data, [{ tab: 'Purchase Lots', row: { ...data['Purchase Lots'][0], totalUnits: 1 } }]),
  );
});
