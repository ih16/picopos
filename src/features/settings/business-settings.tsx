import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For } from 'solid-js';

import { CURRENCY_OPTIONS } from '../../domain/currencies';
import { NUMBER_FORMAT_OPTIONS } from '../../domain/settings';
import { SYNC_INTERVALS } from '../../domain/sync-timing';
import { makeId, type RowChange, type WorkbookData } from '../../domain/workbook';
import { ActionBar, Button, EditorForm, Input, Panel, SelectField } from '../../shared/ui/controls';
import {
  editSetting,
  prepareSettingsSave,
  settingsEditorValues,
  type SettingsDraft,
  type EditableCharge,
} from './settings-draft';

type BusinessSettingsProps = {
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit?: (changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>;
  setup?: {
    interval: number;
    onFinish: (changes: RowChange[], interval: string) => Promise<void>;
    onCancel: () => void;
  };
} & { children?: JSX.Element };

export function BusinessSettings(props: BusinessSettingsProps) {
  const id = crypto.randomUUID();
  const [interval, setSyncInterval] = createSignal(String(props.setup?.interval ?? ''));
  const [draft, setDraft] = createSignal<SettingsDraft>({});
  const values = createMemo(() => settingsEditorValues(props.data, draft()));
  const [localError, setLocalError] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const currencyOptions = createMemo(() =>
    CURRENCY_OPTIONS.some((option) => option.value === values().currency)
      ? CURRENCY_OPTIONS
      : [...CURRENCY_OPTIONS, { value: values().currency, label: values().currency }],
  );
  const updateCharges = (change: (rates: EditableCharge[]) => EditableCharge[]) => {
    setDraft((previous) =>
      editSetting(
        props.data,
        previous,
        'chargeRates',
        change(settingsEditorValues(props.data, previous).chargeRates),
      ),
    );
  };
  const setCharge = (id: string, fields: Partial<EditableCharge>) =>
    updateCharges((rates) => rates.map((rate) => (rate.id === id ? { ...rate, ...fields } : rate)));
  return (
    <Panel class="stack settings-business" role="region" aria-label="Currency and shipping">
      <EditorForm
        class="stack business-settings-form"
        onSubmit={async () => {
          if (props.busy || saving()) return;
          setSaving(true);
          setLocalError('');
          try {
            const { changes, base } = prepareSettingsSave(props.data, draft(), Boolean(props.setup));
            if (props.setup) await props.setup.onFinish(changes, interval());
            else if (changes.length && (await props.onCommit?.(changes, base))) setDraft({});
          } catch (cause) {
            setLocalError(cause instanceof Error ? cause.message : 'Could not save settings.');
          } finally {
            setSaving(false);
          }
        }}
        actions={
          <ActionBar class="settings-save-actions" label="Currency and shipping actions">
            {props.setup && (
              <Button
                class="secondary"
                onClick={props.setup.onCancel}
                disabled={props.busy || saving()}
                icon="close"
                label="Cancel"
              />
            )}
            <Button
              type="submit"
              disabled={props.busy || saving()}
              icon="save"
              label={props.setup ? 'Finish setup' : 'Save settings'}
            />
          </ActionBar>
        }
      >
        {props.children}
        {values().shippingError && (
          <p class="notice error" role="alert">
            {values().shippingError} Add a shipping option to replace the invalid list.
          </p>
        )}
        <section class="settings-form-column stack" aria-labelledby={`${id}-currency`}>
          <div class="settings-section-heading">
            <h2 id={`${id}-currency`}>Currency</h2>
            <p class="muted">Choose the currency used across your workbook.</p>
          </div>
          <div class="settings-currency-fields">
            <SelectField
              label="Currency and symbol"
              value={values().currency}
              options={currencyOptions()}
              disabled={saving()}
              onChange={(value) => {
                if (saving()) return false;
                setDraft(editSetting(props.data, draft(), 'currency', value));
              }}
            />
            <SelectField
              label="Number format"
              value={values().numberFormat}
              options={NUMBER_FORMAT_OPTIONS}
              disabled={saving()}
              onChange={(value) => {
                if (saving()) return false;
                setDraft(editSetting(props.data, draft(), 'numberFormat', value));
              }}
            />
          </div>
          {!props.setup && (
            <p class="muted settings-help">Changing currency does not convert existing amounts.</p>
          )}
        </section>
        <section class="settings-form-column stack" aria-labelledby={`${id}-shipping`}>
          <div class="settings-section-heading">
            <h2 id={`${id}-shipping`}>Shipping rates</h2>
            <p class="muted">Create delivery options. Use a zero rate for pickup.</p>
          </div>
          {values().shippingOptions.length > 0 && (
            <div class="settings-shipping-options">
              <For each={values().shippingOptions} keyed={(row) => row.id}>
                {(option, index) => (
                  <div class="settings-shipping-row">
                    <label class="field">
                      Option name
                      <Input
                        required
                        disabled={saving()}
                        placeholder="Shipping 1 or Pickup"
                        value={option().name}
                        onInput={(event) => {
                          const input = event.currentTarget;
                          if (saving()) return;
                          const rates = settingsEditorValues(props.data, draft()).shippingOptions;
                          setDraft(
                            editSetting(
                              props.data,
                              draft(),
                              'shippingOptions',
                              rates.map((row) =>
                                row.id === option().id ? { ...row, name: input.value } : row,
                              ),
                            ),
                          );
                        }}
                      />
                    </label>
                    <label class="field">
                      Rate ({values().currency.toUpperCase()})
                      <Input
                        required
                        disabled={saving()}
                        type="number"
                        min="0"
                        step="any"
                        inputmode="decimal"
                        placeholder="0"
                        value={option().rate}
                        onInput={(event) => {
                          const input = event.currentTarget;
                          if (saving()) return;
                          const rates = settingsEditorValues(props.data, draft()).shippingOptions;
                          setDraft(
                            editSetting(
                              props.data,
                              draft(),
                              'shippingOptions',
                              rates.map((row) =>
                                row.id === option().id ? { ...row, rate: input.value } : row,
                              ),
                            ),
                          );
                        }}
                      />
                    </label>
                    <Button
                      class="secondary"
                      aria-label={`Remove shipping option ${index() + 1}`}
                      disabled={saving()}
                      onClick={() => {
                        if (saving()) return;
                        const rates = settingsEditorValues(props.data, draft()).shippingOptions;
                        setDraft(
                          editSetting(
                            props.data,
                            draft(),
                            'shippingOptions',
                            rates.filter((row) => row.id !== option().id),
                          ),
                        );
                      }}
                      icon="close"
                      mobileIconOnly
                      label="Remove"
                    />
                  </div>
                )}
              </For>
            </div>
          )}
          {!values().shippingOptions.length && <p class="settings-empty muted">No shipping rates added.</p>}
          <div class="settings-add-shipping">
            <Button
              class="secondary"
              disabled={saving()}
              onClick={() => {
                if (saving()) return;
                const rates = settingsEditorValues(props.data, draft()).shippingOptions;
                setDraft(
                  editSetting(props.data, draft(), 'shippingOptions', [
                    ...rates,
                    { id: makeId(), name: '', rate: '0' },
                  ]),
                );
              }}
              icon="plus"
              label="Add shipping option"
            />
          </div>
        </section>
        <section class="settings-form-column stack" aria-labelledby={id + '-charges'}>
          <div class="settings-section-heading">
            <h2 id={id + '-charges'}>Percentage charges</h2>
            <p class="muted">
              Apply charges automatically to new orders after discounts and before shipping. Each percentage
              uses the product price before charges.
            </p>
          </div>
          {values().chargeError && (
            <p class="notice error" role="alert">
              {values().chargeError} Add a charge to replace the invalid list.
            </p>
          )}
          <For each={values().chargeRates} keyed={(row) => row.id}>
            {(rate, index) => (
              <div class="settings-charge-row">
                <label class="field">
                  Charge name
                  <Input
                    required
                    disabled={saving()}
                    placeholder="VAT or service charge"
                    value={rate().name}
                    onInput={(event) => setCharge(rate().id, { name: event.currentTarget.value })}
                  />
                </label>
                <label class="field">
                  Percentage (%)
                  <Input
                    type="number"
                    required
                    min="0"
                    step="any"
                    inputmode="decimal"
                    disabled={saving()}
                    value={rate().percent}
                    onInput={(event) => setCharge(rate().id, { percent: event.currentTarget.value })}
                  />
                </label>
                <SelectField
                  label="Price treatment"
                  value={rate().mode}
                  disabled={saving()}
                  options={[
                    { value: 'inclusive', label: 'Inclusive · already in price' },
                    { value: 'exclusive', label: 'Exclusive · add to price' },
                  ]}
                  onChange={(value) =>
                    setCharge(rate().id, { mode: value === 'inclusive' ? 'inclusive' : 'exclusive' })
                  }
                />
                <Button
                  class="secondary"
                  aria-label={'Remove charge ' + (index() + 1)}
                  disabled={saving()}
                  onClick={() => updateCharges((rates) => rates.filter((row) => row.id !== rate().id))}
                  icon="close"
                  mobileIconOnly
                  label="Remove"
                />
              </div>
            )}
          </For>
          <div class="settings-add-shipping">
            <Button
              class="secondary"
              disabled={saving()}
              onClick={() =>
                updateCharges((rates) => [
                  ...rates,
                  { id: makeId(), name: '', percent: '', mode: 'exclusive' },
                ])
              }
              icon="plus"
              label="Add charge"
            />
          </div>
        </section>
        {props.setup && (
          <section class="settings-form-column stack" aria-labelledby={`${id}-setup-sync`}>
            <div class="settings-section-heading">
              <h2 id={`${id}-setup-sync`}>Automatic sync</h2>
              <p class="muted">How often this browser syncs while picopos is open.</p>
            </div>
            <SelectField
              label="Sync interval"
              value={interval()}
              options={[...SYNC_INTERVALS]}
              disabled={saving()}
              onChange={(value) => {
                if (saving()) return false;
                setSyncInterval(value);
              }}
            />
          </section>
        )}
        {(localError() || props.error) && (
          <p class="notice error" role="alert">
            {localError() || props.error}
          </p>
        )}
      </EditorForm>
    </Panel>
  );
}
