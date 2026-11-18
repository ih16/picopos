import assert from 'node:assert/strict';
import test from 'node:test';
import { applyChanges, customerDirectory, emptyWorkbook, validateChanges } from '../src/domain/workbook.ts';
import { demoWorkbook } from '../src/domain/demo.ts';

test('directory separates unlinked contacts and preserves linked history after editing or archiving', () => {
  const data = demoWorkbook();
  const customer = data.Customers[0];
  const updated = applyChanges(data, [
    { tab: 'Customers', row: { ...customer, name: 'Maya Updated', active: false } },
  ]);
  const entry = customerDirectory(updated).find((entry) => entry.customer.id === customer.id)!;
  assert.equal(entry.orders.length, 1);
  assert.equal(entry.orders[0].customer, 'Maya Chen');
  assert.equal(entry.customer.name, 'Maya Updated');
  assert.equal(entry.customer.active, false);
  assert.equal(customerDirectory(updated).filter((entry) => !entry.saved).length, 3);
});

test('same-name contacts with different details are not merged', () => {
  const data = demoWorkbook();
  data.Orders[2] = { ...data.Orders[2], customer: data.Orders[1].customer, contact: 'another@example.com' };
  assert.equal(customerDirectory(data).filter((entry) => !entry.saved).length, 3);
});

test('customer validation rejects blank names and broken order links', () => {
  assert.throws(
    () =>
      validateChanges(emptyWorkbook(), [
        { tab: 'Customers', row: { id: 'c', name: ' ', contact: '', address: '', notes: '', active: true } },
      ]),
    /customer name/,
  );
  const data = demoWorkbook();
  assert.throws(
    () => validateChanges(data, [{ tab: 'Orders', row: { ...data.Orders[0], customerId: 'missing' } }]),
    /existing customer/,
  );
  assert.doesNotThrow(() =>
    validateChanges(data, [{ tab: 'Customers', row: { ...data.Customers[0], active: false } }]),
  );
});
