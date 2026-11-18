import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyWorkbook } from '../src/domain/workbook.ts';
import { workbookCurrency } from '../src/domain/settings.ts';
import { money } from '../src/shared/lib/format.ts';

test('all screens normalize user-edited currency settings and fall back for invalid values', () => {
  const data = emptyWorkbook();
  assert.equal(workbookCurrency(data), 'USD');
  data.Settings = [{ id: 'currency', value: ' bdt ' }];
  assert.equal(workbookCurrency(data), 'BDT');
  data.Settings[0].value = 'not a currency';
  assert.equal(workbookCurrency(data), 'USD');
  assert.doesNotThrow(() => money(25, workbookCurrency(data)));
});
