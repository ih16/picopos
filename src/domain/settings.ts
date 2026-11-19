import type { WorkbookData } from './workbook';

/** Sheets settings are user-editable; keep currency rendering safe across screens. */
export function workbookCurrency(data: WorkbookData): string {
  const value = data.Settings.find((setting) => setting.id.toLowerCase() === 'currency')
    ?.value.trim()
    .toUpperCase();
  return value && /^[A-Z]{3}$/.test(value) ? value : 'USD';
}

export const NUMBER_FORMAT_OPTIONS = [
  { value: 'en-US', label: '1,234,567.89 (Western grouping)' },
  { value: 'en-IN', label: '12,34,567.89 (South Asian grouping)' },
  { value: 'de-DE', label: '1.234.567,89 (Periods and decimal comma)' },
  { value: 'fr-FR', label: '1 234 567,89 (Spaces and decimal comma)' },
];

export function workbookNumberFormat(data: WorkbookData): string {
  const value = data.Settings.find((setting) => setting.id === 'numberFormat')?.value.trim();
  return (
    NUMBER_FORMAT_OPTIONS.find((format) => format.value === value)?.value ?? NUMBER_FORMAT_OPTIONS[0].value
  );
}
