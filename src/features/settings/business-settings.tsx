import { component$, useId, useSignal, useTask$, type QRL } from '@builder.io/qwik';
import { NUMBER_FORMAT_OPTIONS, workbookNumberFormat } from '../../domain/settings';
import { CURRENCY_OPTIONS } from '../../domain/currencies';
import { getShippingOptions, makeId, type RowChange, type WorkbookData } from '../../domain/workbook';
import { SYNC_INTERVALS } from '../../domain/sync-timing';
import { ActionBar, Button, Input, Panel, SelectField } from '../../shared/ui/controls';

export const BusinessSettings = component$<{
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit$?: QRL<(changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>>;
  setup?: {
    interval: number;
    onFinish$: QRL<(changes: RowChange[], interval: string) => Promise<void>>;
    onCancel$: QRL<() => void>;
  };
}>(({ data, busy, error, onCommit$, setup }) => {
  const id = useId();
  const interval = useSignal(String(setup?.interval ?? ''));
  const currency = useSignal('USD');
  const numberFormat = useSignal(NUMBER_FORMAT_OPTIONS[0].value);
  const options = useSignal<{ id: string; name: string; rate: string }[]>([]);
  const base = useSignal<RowChange[]>([]);
  const localError = useSignal('');
  const settingsError = useSignal('');
  useTask$(({ track }) => {
    const savedCurrency = track(() => data.Settings.find((row) => row.id === 'currency')?.value);
    track(() => data.Settings.find((row) => row.id === 'shippingOptions')?.value);
    currency.value = savedCurrency || 'USD';
    numberFormat.value = track(() => workbookNumberFormat(data));
    settingsError.value = '';
    try {
      options.value = getShippingOptions(data).map((option) => ({ ...option, rate: String(option.rate) }));
    } catch (cause) {
      options.value = [];
      settingsError.value = (cause as Error).message;
    }
    base.value = data.Settings.filter((row) =>
      ['currency', 'numberFormat', 'shippingOptions'].includes(row.id),
    ).map((row) => ({ tab: 'Settings', row: { ...row } }));
    localError.value = '';
  });
  const currencyOptions = CURRENCY_OPTIONS.some((option) => option.value === currency.value)
    ? CURRENCY_OPTIONS
    : [...CURRENCY_OPTIONS, { value: currency.value, label: currency.value }];
  return (
    <Panel class="stack settings-business" role="region" aria-label="Currency and shipping">
      {settingsError.value && (
        <p class="notice error" role="alert">
          {settingsError.value} Save settings to replace the invalid options.
        </p>
      )}
      <form
        class="stack business-settings-form"
        preventdefault:submit
        onSubmit$={async () => {
          localError.value = '';
          const code = currency.value.trim().toUpperCase();
          if (!/^[A-Z]{3}$/.test(code)) {
            localError.value = 'Enter a three-letter currency code, such as USD or BDT.';
            return;
          }
          const changes: RowChange[] = [
            { tab: 'Settings', row: { id: 'currency', value: code } },
            { tab: 'Settings', row: { id: 'numberFormat', value: numberFormat.value } },
            {
              tab: 'Settings',
              row: {
                id: 'shippingOptions',
                value: JSON.stringify(
                  options.value.map((option) => ({
                    ...option,
                    name: option.name.trim(),
                    rate: Number(option.rate),
                  })),
                ),
              },
            },
          ];
          if (setup) await setup.onFinish$(changes, interval.value);
          else await onCommit$?.(changes, base.value);
        }}
      >
        <section class="settings-form-column stack" aria-labelledby={`${id}-currency`}>
          <div class="settings-section-heading">
            <h2 id={`${id}-currency`}>Currency</h2>
            <p class="muted">Choose the currency used across your workbook.</p>
          </div>
          <div class="settings-currency-fields">
            <SelectField
              label="Currency and symbol"
              value={currency.value}
              options={currencyOptions}
              onChange$={(value) => {
                currency.value = value;
              }}
            />
            <SelectField
              label="Number format"
              value={numberFormat.value}
              options={NUMBER_FORMAT_OPTIONS}
              onChange$={(value) => {
                numberFormat.value = value;
              }}
            />
          </div>
          {!setup && <p class="muted settings-help">Changing currency does not convert existing amounts.</p>}
        </section>
        <section class="settings-form-column stack" aria-labelledby={`${id}-shipping`}>
          <div class="settings-section-heading">
            <h2 id={`${id}-shipping`}>Shipping rates</h2>
            <p class="muted">Create delivery options. Use a zero rate for pickup.</p>
          </div>
          {options.value.length > 0 && (
            <div class="settings-shipping-options" role="region" aria-label="Shipping options" tabIndex={0}>
              {options.value.map((option, index) => (
                <div class="settings-shipping-row" key={option.id}>
                  <label class="field">
                    Option name
                    <Input
                      required
                      placeholder="Shipping 1 or Pickup"
                      value={option.name}
                      onInput$={(_, input) => {
                        options.value = options.value.map((row) =>
                          row.id === option.id ? { ...row, name: input.value } : row,
                        );
                      }}
                    />
                  </label>
                  <label class="field">
                    Rate ({currency.value.toUpperCase()})
                    <Input
                      required
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder="0"
                      value={option.rate}
                      onInput$={(_, input) => {
                        options.value = options.value.map((row) =>
                          row.id === option.id ? { ...row, rate: input.value } : row,
                        );
                      }}
                    />
                  </label>
                  <Button
                    class="secondary"
                    aria-label={`Remove shipping option ${index + 1}`}
                    onClick$={() => {
                      options.value = options.value.filter((row) => row.id !== option.id);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          {!options.value.length && <p class="settings-empty muted">No shipping rates added.</p>}
          <div>
            <Button
              class="secondary"
              onClick$={() => {
                options.value = [...options.value, { id: makeId(), name: '', rate: '0' }];
              }}
            >
              Add shipping option
            </Button>
          </div>
        </section>
        {setup && (
          <section class="settings-form-column stack" aria-labelledby={`${id}-setup-sync`}>
            <div class="settings-section-heading">
              <h2 id={`${id}-setup-sync`}>Automatic sync</h2>
              <p class="muted">How often this browser syncs while picopos is open.</p>
            </div>
            <SelectField
              label="Sync interval"
              value={interval.value}
              options={[...SYNC_INTERVALS]}
              onChange$={(value) => {
                interval.value = value;
              }}
            />
          </section>
        )}
        {(localError.value || error) && (
          <p class="notice error" role="alert">
            {localError.value || error}
          </p>
        )}
        <ActionBar class="settings-save-actions" label="Currency and shipping actions">
          {setup && (
            <Button class="secondary" onClick$={setup.onCancel$} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {setup ? 'Finish setup' : 'Save settings'}
          </Button>
        </ActionBar>
      </form>
    </Panel>
  );
});
