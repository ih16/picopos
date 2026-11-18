import type { WorkbookData } from './workbook';

/** Sheets settings are user-editable; keep currency rendering safe across screens. */
export function workbookCurrency(data: WorkbookData): string {
  const value = data.Settings.find((setting) => setting.id.toLowerCase() === 'currency')
    ?.value.trim()
    .toUpperCase();
  return value && /^[A-Z]{3}$/.test(value) ? value : 'USD';
}
