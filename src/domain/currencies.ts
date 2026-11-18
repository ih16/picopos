// Intl uses the runtime's Unicode currency data and works without a network request.
const names = new Intl.DisplayNames(['en'], { type: 'currency' });
export const CURRENCY_OPTIONS = Intl.supportedValuesOf('currency').map((code) => {
  const symbol =
    new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? code;
  return { value: code, label: `${code} — ${names.of(code)} (${symbol})` };
});
