import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyWorkbook } from '../src/domain/workbook.ts';
import {
  editSetting,
  prepareSettingsSave,
  settingsEditorValues,
} from '../src/features/settings/settings-draft.ts';

test('a synced preference refreshes untouched fields without resetting edits or their original baselines', () => {
  const data = emptyWorkbook();
  const shippingOptions = JSON.stringify([{ id: 'local', name: 'Local', rate: 5 }]);
  data.Settings = [
    { id: 'currency', value: 'USD' },
    { id: 'numberFormat', value: 'en-US' },
    { id: 'shippingOptions', value: shippingOptions },
  ];
  let draft = editSetting(data, {}, 'currency', 'BDT');
  draft = editSetting(data, draft, 'shippingOptions', [{ id: 'local', name: 'Local delivery', rate: '' }]);

  const refreshed = {
    ...data,
    Settings: [
      { id: 'currency', value: 'EUR' },
      { id: 'numberFormat', value: 'en-IN' },
      { id: 'shippingOptions', value: JSON.stringify([{ id: 'local', name: 'Local', rate: 8 }]) },
    ],
  };
  assert.deepEqual(settingsEditorValues(refreshed, draft), {
    currency: 'BDT',
    numberFormat: 'en-IN',
    shippingOptions: [{ id: 'local', name: 'Local delivery', rate: '' }],
    shippingError: '',
    chargeRates: [],
    chargeError: '',
  });

  draft = editSetting(refreshed, draft, 'shippingOptions', [
    { id: 'local', name: 'Local delivery', rate: '6' },
  ]);
  const { changes, base } = prepareSettingsSave(refreshed, draft, false);
  assert.deepEqual(changes, [
    { tab: 'Settings', row: { id: 'currency', value: 'BDT' } },
    {
      tab: 'Settings',
      row: {
        id: 'shippingOptions',
        value: JSON.stringify([{ id: 'local', name: 'Local delivery', rate: 6 }]),
      },
    },
  ]);
  assert.deepEqual(
    base,
    [data.Settings[0], data.Settings[2]].map((row) => ({ tab: 'Settings', row })),
  );
});

test('setup submits defaults and changes together, whereas a regular save submits only the draft', () => {
  const data = emptyWorkbook();
  const draft = editSetting(data, {}, 'numberFormat', 'de-DE');
  assert.deepEqual(prepareSettingsSave(data, draft, true), {
    changes: [
      { tab: 'Settings', row: { id: 'currency', value: 'USD' } },
      { tab: 'Settings', row: { id: 'numberFormat', value: 'de-DE' } },
      { tab: 'Settings', row: { id: 'shippingOptions', value: '[]' } },
    ],
    base: [],
  });
  assert.deepEqual(prepareSettingsSave(data, draft, false), {
    changes: [{ tab: 'Settings', row: { id: 'numberFormat', value: 'de-DE' } }],
    base: [],
  });
});
