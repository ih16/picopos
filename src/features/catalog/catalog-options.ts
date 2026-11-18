import type { Product, Variant } from '../../domain/workbook';

export type ProductOption = { id: string; name: string; firstValue: string; saved: boolean };
export type VariantOption = { name: string; value: string; originalValue: string };

export const optionSeparator = ' / ';
export const optionNamesOf = (text: string) =>
  text
    .split('/')
    .map((name) => name.trim())
    .filter(Boolean);

export function readVariantOptions(names: string[], text: string): VariantOption[] {
  let values = [text];
  if (names.length > 1) {
    const spaced = text.replace(/^\/ /, ' / ').replace(/ \/$/, ' / ').split(optionSeparator);
    const legacy = text.split('/');
    values = spaced.length > 1 ? spaced : legacy.length === names.length ? legacy : [text];
  }
  return names.map((name, index) => {
    const value = (
      index === names.length - 1 ? values.slice(index).join(optionSeparator) : (values[index] ?? '')
    ).trim();
    return { name, value, originalValue: value };
  });
}

export function validateOptionValues(values: string[]) {
  if (values.some((value) => !value)) return 'Enter a value for each option.';
  if (values.length > 1 && values.some((value) => value.includes(optionSeparator))) {
    return 'Enter one value in each option field.';
  }
  return '';
}

export const newProduct = (categoryId: string): Product => ({
  id: '',
  name: '',
  categoryId,
  description: '',
  optionNames: '',
  active: true,
});
export const newVariant = (productId: string): Variant => ({
  id: '',
  productId,
  sku: '',
  optionValues: '',
  price: 0,
  active: true,
});
export const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];
