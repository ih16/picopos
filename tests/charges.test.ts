import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCharges, chargeRates, savedCharges, type ChargeRate } from '../src/domain/charges.ts';
import { orderTotal } from '../src/domain/order-totals.ts';

const rates: ChargeRate[] = [
  { id: 'vat', name: 'VAT', percent: 15, mode: 'inclusive' },
  { id: 'service', name: 'Service charge', percent: 5, mode: 'exclusive' },
];

test('charges share the discounted selling price before shipping and preserve the saved breakdown', () => {
  const charges = calculateCharges(125 - 10, rates, 'USD');
  assert.deepEqual(
    charges.map((row) => row.amount),
    [15, 5],
  );
  const order = { charges: JSON.stringify(charges), discount: 10, shippingCharge: 6 };
  assert.equal(orderTotal(125, order), 126);
  assert.deepEqual(savedCharges(order.charges), charges);
  assert.equal(orderTotal(125, { ...order, charges: undefined }), 121);
});

test('multiple inclusive charges use one base and round to the currency precision', () => {
  const bothIncluded = rates.map((rate) => ({ ...rate, mode: 'inclusive' as const }));
  const amounts = (gross: number, currency: string) =>
    calculateCharges(gross, bothIncluded, currency).map((charge) => charge.amount);
  assert.deepEqual(amounts(120, 'USD'), [15, 5]);
  assert.deepEqual(amounts(1, 'JPY'), [0, 0]);
  assert.deepEqual(amounts(1, 'KWD'), [0.125, 0.042]);
  assert.deepEqual(amounts(0, 'USD'), [0, 0]);
  assert.equal(calculateCharges(201.5, [rates[1]], 'USD')[0].amount, 10.08);
});

test('charge settings and snapshots reject invalid values', () => {
  for (const patch of [{ name: ' ' }, { percent: -1 }, { mode: 'other' }, { percent: '7' }])
    assert.throws(() => chargeRates(JSON.stringify([{ ...rates[0], ...patch }])));
  assert.throws(() => chargeRates(JSON.stringify([rates[0], rates[0]])));
  assert.throws(() => savedCharges(JSON.stringify(rates)));
});
