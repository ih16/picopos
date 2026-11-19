import { component$, useComputed$, useId, useSignal, type QRL } from '@builder.io/qwik';
import { NUMBER_FORMAT_OPTIONS } from '../../domain/settings';
import { CURRENCY_OPTIONS } from '../../domain/currencies';
import { makeId, type RowChange, type WorkbookData } from '../../domain/workbook';
import { SYNC_INTERVALS } from '../../domain/sync-timing';
import { ActionBar, Button, Input, Panel, SelectField } from '../../shared/ui/controls';
import { editSetting, prepareSettingsSave, settingsEditorValues, type SettingsDraft } from './settings-draft';

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
  const draft = useSignal<SettingsDraft>({});
  const values = useComputed$(() => settingsEditorValues(data, draft.value));
  const localError = useSignal('');
  const saving = useSignal(false);
  const currencyOptions = CURRENCY_OPTIONS.some((option) => option.value === values.value.currency)
    ? CURRENCY_OPTIONS
    : [...CURRENCY_OPTIONS, { value: values.value.currency, label: values.value.currency }];
  return (
    <Panel class="stack settings-business" role="region" aria-label="Currency and shipping">
      {values.value.shippingError && (
        <p class="notice error" role="alert">
          {values.value.shippingError} Add a shipping option to replace the invalid list.
        </p>
      )}
      <form
        class="stack business-settings-form"
        preventdefault:submit
        onSubmit$={async () => {
          if (busy || saving.value) return;
          saving.value = true;
          localError.value = '';
          try {
            const { changes, base } = prepareSettingsSave(data, draft.value, Boolean(setup));
            if (setup) await setup.onFinish$(changes, interval.value);
            else if (changes.length && (await onCommit$?.(changes, base))) draft.value = {};
          } catch (cause) {
            localError.value = cause instanceof Error ? cause.message : 'Could not save settings.';
          } finally {
            saving.value = false;
          }
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
              value={values.value.currency}
              options={currencyOptions}
              disabled={saving.value}
              onChange$={(value) => {
                if (saving.value) return false;
                draft.value = editSetting(data, draft.value, 'currency', value);
              }}
            />
            <SelectField
              label="Number format"
              value={values.value.numberFormat}
              options={NUMBER_FORMAT_OPTIONS}
              disabled={saving.value}
              onChange$={(value) => {
                if (saving.value) return false;
                draft.value = editSetting(data, draft.value, 'numberFormat', value);
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
          {values.value.shippingOptions.length > 0 && (
            <div class="settings-shipping-options">
              {values.value.shippingOptions.map((option, index) => (
                <div class="settings-shipping-row" key={option.id}>
                  <label class="field">
                    Option name
                    <Input
                      required
                      disabled={saving.value}
                      placeholder="Shipping 1 or Pickup"
                      value={option.name}
                      onInput$={(_, input) => {
                        if (saving.value) return;
                        const rates = settingsEditorValues(data, draft.value).shippingOptions;
                        draft.value = editSetting(
                          data,
                          draft.value,
                          'shippingOptions',
                          rates.map((row) => (row.id === option.id ? { ...row, name: input.value } : row)),
                        );
                      }}
                    />
                  </label>
                  <label class="field">
                    Rate ({values.value.currency.toUpperCase()})
                    <Input
                      required
                      disabled={saving.value}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder="0"
                      value={option.rate}
                      onInput$={(_, input) => {
                        if (saving.value) return;
                        const rates = settingsEditorValues(data, draft.value).shippingOptions;
                        draft.value = editSetting(
                          data,
                          draft.value,
                          'shippingOptions',
                          rates.map((row) => (row.id === option.id ? { ...row, rate: input.value } : row)),
                        );
                      }}
                    />
                  </label>
                  <Button
                    class="secondary"
                    aria-label={`Remove shipping option ${index + 1}`}
                    disabled={saving.value}
                    onClick$={() => {
                      if (saving.value) return;
                      const rates = settingsEditorValues(data, draft.value).shippingOptions;
                      draft.value = editSetting(
                        data,
                        draft.value,
                        'shippingOptions',
                        rates.filter((row) => row.id !== option.id),
                      );
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          {!values.value.shippingOptions.length && (
            <p class="settings-empty muted">No shipping rates added.</p>
          )}
          <div>
            <Button
              class="secondary"
              disabled={saving.value}
              onClick$={() => {
                if (saving.value) return;
                const rates = settingsEditorValues(data, draft.value).shippingOptions;
                draft.value = editSetting(data, draft.value, 'shippingOptions', [
                  ...rates,
                  { id: makeId(), name: '', rate: '0' },
                ]);
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
              disabled={saving.value}
              onChange$={(value) => {
                if (saving.value) return false;
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
            <Button class="secondary" onClick$={setup.onCancel$} disabled={busy || saving.value}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy || saving.value}>
            {setup ? 'Finish setup' : 'Save settings'}
          </Button>
        </ActionBar>
      </form>
    </Panel>
  );
});
