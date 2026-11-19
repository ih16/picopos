import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyWorkbook } from '../src/domain/workbook.ts';
import { workbookCurrency, workbookNumberFormat } from '../src/domain/settings.ts';
import { decimalAmount, money } from '../src/shared/lib/format.ts';

test('all screens normalize user-edited currency settings and fall back for invalid values', () => {
  const data = emptyWorkbook();
  assert.equal(workbookCurrency(data), 'USD');
  data.Settings = [{ id: 'currency', value: ' bdt ' }];
  assert.equal(workbookCurrency(data), 'BDT');
  data.Settings[0].value = 'not a currency';
  assert.equal(workbookCurrency(data), 'USD');
  assert.doesNotThrow(() => money(25, workbookCurrency(data)));
});

test('workbooks default to Western grouping and apply the saved number format', () => {
  const data = emptyWorkbook();
  assert.equal(decimalAmount(1234567.89, workbookNumberFormat(data)), '1,234,567.89');
  data.Settings = [{ id: 'numberFormat', value: 'en-IN' }];
  assert.equal(decimalAmount(1234567.89, workbookNumberFormat(data)), '12,34,567.89');
  data.Settings[0].value = 'de-DE';
  assert.match(money(1234567.89, 'USD', workbookNumberFormat(data)), /1\.234\.567,89/);
  data.Settings[0].value = 'bad-format';
  assert.equal(workbookNumberFormat(data), 'en-US');
});
