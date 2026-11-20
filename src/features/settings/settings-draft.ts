import { chargeRates, type ChargeRate } from '../../domain/charges.ts';
import { workbookNumberFormat } from '../../domain/settings.ts';
import { getShippingOptions, type RowChange, type WorkbookData } from '../../domain/workbook.ts';

type ShippingRate = { id: string; name: string; rate: string };
export type EditableCharge = Omit<ChargeRate, 'percent'> & { percent: string };
type SettingsValues = {
  chargeRates: EditableCharge[];
  currency: string;
  numberFormat: string;
  shippingOptions: ShippingRate[];
};
type Setting = keyof SettingsValues;

export type SettingsDraft = {
  [K in Setting]?: { value: SettingsValues[K]; before?: string };
};

function savedValue(data: WorkbookData, id: Setting) {
  return data.Settings.find((row) => row.id === id)?.value;
}

export function editSetting<K extends Setting>(
  data: WorkbookData,
  draft: SettingsDraft,
  id: K,
  value: SettingsValues[K],
): SettingsDraft {
  const previous = draft[id];
  return { ...draft, [id]: { value, before: previous ? previous.before : savedValue(data, id) } };
}

export function settingsEditorValues(data: WorkbookData, draft: SettingsDraft) {
  let shippingOptions = draft.shippingOptions?.value ?? [];
  let shippingError = '';
  if (!draft.shippingOptions) {
    try {
      shippingOptions = getShippingOptions(data).map((option) => ({ ...option, rate: String(option.rate) }));
    } catch (cause) {
      shippingError = (cause as Error).message;
    }
  }
  let charges = draft.chargeRates?.value ?? [];
  let chargeError = '';
  if (!draft.chargeRates) {
    try {
      charges = chargeRates(savedValue(data, 'chargeRates') ?? '[]').map((rate) => ({
        ...rate,
        percent: String(rate.percent),
      }));
    } catch (cause) {
      chargeError = (cause as Error).message;
    }
  }
  return {
    chargeRates: charges,
    chargeError,
    currency: draft.currency?.value ?? (savedValue(data, 'currency') || 'USD'),
    numberFormat: draft.numberFormat?.value ?? workbookNumberFormat(data),
    shippingOptions,
    shippingError,
  };
}

export function prepareSettingsSave(data: WorkbookData, draft: SettingsDraft, setup: boolean) {
  const values = settingsEditorValues(data, draft);
  const changes: RowChange[] = [];
  const base: RowChange[] = [];
  const add = (id: Setting, value: string) => {
    changes.push({ tab: 'Settings', row: { id, value } });
    const before = draft[id] ? draft[id].before : savedValue(data, id);
    if (before !== undefined) base.push({ tab: 'Settings', row: { id, value: before } });
  };

  if (setup || draft.currency) {
    const currency = values.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
      throw new Error('Enter a three-letter currency code, such as USD or BDT.');
    add('currency', currency);
  }
  if (setup || draft.numberFormat) add('numberFormat', values.numberFormat);
  if (setup || draft.shippingOptions) {
    const shipping = values.shippingOptions.map((option) => ({
      ...option,
      name: option.name.trim(),
      rate: Number(option.rate),
    }));
    add('shippingOptions', JSON.stringify(shipping));
  }
  if (draft.chargeRates) {
    const serialized = JSON.stringify(
      values.chargeRates.map((rate) => ({
        ...rate,
        name: rate.name.trim(),
        percent: rate.percent.trim() ? Number(rate.percent) : null,
      })),
    );
    chargeRates(serialized);
    add('chargeRates', serialized);
  }
  return { changes, base };
}
