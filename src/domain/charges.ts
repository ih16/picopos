export type ChargeRate = { id: string; name: string; percent: number; mode: 'inclusive' | 'exclusive' };
export type OrderCharge = ChargeRate & { amount: number };

export function chargeRates(value: string): ChargeRate[] {
  let rows: unknown;
  try {
    rows = JSON.parse(value);
  } catch {
    throw new Error('Percentage charges must be a valid list.');
  }
  if (!Array.isArray(rows)) throw new Error('Percentage charges must be a valid list.');
  const ids = new Set<string>();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !row.id ||
      ids.has(row.id) ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      !Number.isFinite(row.percent) ||
      row.percent < 0 ||
      !['inclusive', 'exclusive'].includes(row.mode)
    )
      throw new Error(
        'Give each charge a name, a nonnegative percentage, and an inclusive or exclusive mode.',
      );
    ids.add(row.id);
  }
  return rows;
}

export function savedCharges(value?: string): OrderCharge[] {
  if (!value) return [];
  const rows = chargeRates(value);
  if (
    !rows.every(
      (row): row is OrderCharge =>
        'amount' in row && typeof row.amount === 'number' && Number.isFinite(row.amount) && row.amount >= 0,
    )
  )
    throw new Error('Each saved order charge needs a nonnegative amount.');
  return rows;
}

export function calculateCharges(
  productAmount: number,
  rates: ChargeRate[],
  currency: string,
): OrderCharge[] {
  if (!rates.length) return [];
  const included = rates.reduce((sum, rate) => sum + (rate.mode === 'inclusive' ? rate.percent : 0), 0);
  const base = Math.max(0, productAmount) / (1 + included / 100);
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const round = new Intl.NumberFormat('en', { useGrouping: false, maximumFractionDigits: digits });
  return rates.map((rate) => ({
    ...rate,
    amount: Number(round.format((base * rate.percent) / 100)),
  }));
}

export function addedCharges(charges: OrderCharge[]) {
  return charges.reduce((sum, charge) => sum + (charge.mode === 'exclusive' ? charge.amount : 0), 0);
}

export function chargeLabel(charge: ChargeRate) {
  return `${charge.name} (${charge.percent}% · ${charge.mode === 'inclusive' ? 'included' : 'added'})`;
}
