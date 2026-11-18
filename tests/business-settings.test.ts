import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyChanges,
  emptyWorkbook,
  getShippingOptions,
  validateChanges,
  type RowChange,
} from '../src/domain/workbook.ts';

test('currency and named shipping options persist in workbook settings, including free pickup', () => {
  const data = emptyWorkbook();
  assert.deepEqual(getShippingOptions(data), []);
  const options = [
    { id: 'delivery', name: 'Shipping 1', rate: 60 },
    { id: 'pickup', name: 'Pickup', rate: 0 },
  ];
  const changes: RowChange[] = [
    { tab: 'Settings', row: { id: 'currency', value: 'BDT' } },
    { tab: 'Settings', row: { id: 'shippingOptions', value: JSON.stringify(options) } },
  ];
  validateChanges(data, changes);
  const saved = applyChanges(data, changes);
  assert.deepEqual(getShippingOptions(saved), options);
  assert.equal(saved.Settings[0].value, 'BDT');
  const cleared: RowChange[] = [{ tab: 'Settings', row: { id: 'shippingOptions', value: '[]' } }];
  validateChanges(saved, cleared);
  assert.deepEqual(getShippingOptions(applyChanges(saved, cleared)), []);
});

test('settings reject invalid currency, unnamed options, invalid rates and duplicate IDs', () => {
  const data = emptyWorkbook();
  assert.throws(
    () => validateChanges(data, [{ tab: 'Settings', row: { id: 'currency', value: '$' } }]),
    /currency code/,
  );
  for (const value of [
    'bad json',
    '{}',
    '[{"id":"a","name":"","rate":0}]',
    '[{"id":"a","name":"Delivery","rate":-1}]',
    '[{"id":"a","name":"Delivery","rate":null}]',
    '[{"id":"a","name":"A","rate":0},{"id":"a","name":"B","rate":1}]',
  ]) {
    assert.throws(() => validateChanges(data, [{ tab: 'Settings', row: { id: 'shippingOptions', value } }]));
  }
});

test('changing shipping settings preserves the name and charge saved on existing orders', () => {
  const data = emptyWorkbook();
  data.Orders = [
    {
      id: 'o',
      number: '1',
      customer: 'Sam',
      contact: '',
      address: '',
      createdAt: '',
      status: 'Draft',
      paymentStatus: 'Unpaid',
      notes: '',
      discount: 0,
      shippingOption: 'Shipping 1',
      shippingCharge: 60,
    },
  ];
  const changes: RowChange[] = [{ tab: 'Settings', row: { id: 'shippingOptions', value: '[]' } }];
  validateChanges(data, changes);
  assert.deepEqual(applyChanges(data, changes).Orders, data.Orders);
});
