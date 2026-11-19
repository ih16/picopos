import { decimalAmount } from '../../shared/lib/format';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import { $, component$, Fragment, useSignal, type QRL } from '@builder.io/qwik';
import {
  makeId,
  purchaseLotSummary,
  type PurchaseLot,
  type RowChange,
  type WorkbookData,
} from '../../domain/workbook';
import { ActionBar, EditorForm, Badge, Button, Input, Modal, Panel, Table } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductLabel } from '../../shared/ui/product-thumbnail';
import { ReconnectNotice } from '../auth/connection';

export const PurchaseLots = component$<{
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit$: QRL<(changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>>;
}>(({ data, busy, error, onCommit$ }) => {
  const open = useSignal(false);
  const expandedLots = useSignal<string[]>([]);
  const base = useSignal<PurchaseLot>();
  const name = useSignal('');
  const amount = useSignal('');
  const units = useSignal('');
  const attempted = useSignal(false);
  const edit = $((lot?: PurchaseLot) => {
    base.value = lot ? { ...lot } : undefined;
    name.value = lot?.name ?? '';
    amount.value = lot ? String(lot.totalAmount) : '';
    units.value = lot ? String(lot.totalUnits) : '';
    attempted.value = false;
    open.value = true;
  });
  const currency = workbookCurrency(data);
  const numberFormat = workbookNumberFormat(data);
  return (
    <Panel class="stack" role="region" aria-label="Purchase lots">
      {!open.value && (
        <ActionBar class="record-shortcut" label="Purchase lot actions">
          <Button disabled={busy} onClick$={() => edit()} icon="lot-add" label="Add purchase lot" />
        </ActionBar>
      )}
      <div class="component-scroll">
        {data['Purchase Lots'].length ? (
          <Table class="scroll-rows purchase-lots-table" aria-label="Purchase lots">
            <thead>
              <tr>
                <th scope="col">Purchase lot</th>
                <th scope="col" class="numeric">
                  Total purchase ({currency})
                </th>
                <th scope="col" class="numeric">
                  Purchased units
                </th>
                <th scope="col" class="numeric">
                  Linked units
                </th>
                <th scope="col" class="numeric">
                  Average cost / unit ({currency})
                </th>
                <th scope="col">Status</th>
                <th scope="col">Stock entries</th>
                <th scope="col" class="table-actions">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data['Purchase Lots'].map((lot) => {
                const summary = purchaseLotSummary(data, lot.id);
                const difference = lot.totalUnits - summary.units;
                const entries = data['Stock Entries']
                  .filter((entry) => entry.purchaseLotId === lot.id)
                  .sort((a, b) => b.date.localeCompare(a.date));
                const expanded = expandedLots.value.includes(lot.id);
                return (
                  <Fragment key={lot.id}>
                    <tr>
                      <td>
                        <strong>{lot.name}</strong>
                      </td>
                      <td class="numeric" data-label={`Purchase (${currency})`}>
                        {decimalAmount(lot.totalAmount, numberFormat)}
                      </td>
                      <td class="numeric" data-label="Purchased units">
                        {lot.totalUnits}
                      </td>
                      <td class="numeric" data-label="Linked units">
                        {summary.units}
                      </td>
                      <td class="numeric" data-label={`Cost per unit (${currency})`}>
                        {decimalAmount(lot.totalAmount / lot.totalUnits, numberFormat)}
                      </td>
                      <td>
                        <Badge>
                          {difference === 0
                            ? 'Count matches'
                            : difference > 0
                              ? `${difference} units remaining`
                              : `${-difference} units over`}
                        </Badge>
                      </td>
                      <td>
                        {entries.length ? (
                          <Button
                            class="secondary compact variant-toggle"
                            title={expanded ? 'Hide stock entries' : 'Show stock entries'}
                            aria-label={`Stock entries for ${lot.name}`}
                            aria-expanded={expanded}
                            aria-controls={`lot-entries-${lot.id}`}
                            onClick$={() => {
                              expandedLots.value = expandedLots.value.includes(lot.id)
                                ? expandedLots.value.filter((id) => id !== lot.id)
                                : [...expandedLots.value, lot.id];
                            }}
                          >
                            <span>
                              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                            </span>
                            <span class="control-chevron" aria-hidden="true" />
                          </Button>
                        ) : (
                          <span class="muted">No entries</span>
                        )}
                      </td>
                      <td class="table-actions">
                        <Button
                          class="secondary compact catalog-icon-button"
                          disabled={busy}
                          title="Edit purchase lot"
                          aria-label={`Edit purchase lot ${lot.name}`}
                          onClick$={() => edit(lot)}
                        >
                          <Icon name="edit" />
                        </Button>
                      </td>
                    </tr>
                    {entries.length > 0 && (
                      <tr id={`lot-entries-${lot.id}`} hidden={!expanded}>
                        <td colSpan={8}>
                          {expanded && (
                            <div class="stack">
                              <p class="muted">
                                Sales do not change linked units. Average cost is estimated across all
                                purchased units.
                              </p>
                              <Table class="lot-entry-table" aria-label={`Stock entries for ${lot.name}`}>
                                <thead>
                                  <tr>
                                    <th scope="col">Date</th>
                                    <th scope="col">Variant</th>
                                    <th scope="col">SKU</th>
                                    <th scope="col">Entry</th>
                                    <th scope="col" class="numeric">
                                      On-hand change
                                    </th>
                                    <th scope="col" class="numeric">
                                      Unavailable change
                                    </th>
                                    <th scope="col">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.map((entry) => {
                                    const variant = data.Variants.find((row) => row.id === entry.variantId);
                                    const product = data.Products.find(
                                      (row) => row.id === variant?.productId,
                                    );
                                    return (
                                      <tr key={entry.id}>
                                        <td>{entry.date.slice(0, 10)}</td>
                                        <td>
                                          <ProductLabel
                                            name={product?.name || 'Unknown product'}
                                            image={product?.image}
                                          >
                                            {[product?.name || 'Unknown product', variant?.optionValues]
                                              .filter(Boolean)
                                              .join(' · ')}
                                          </ProductLabel>
                                        </td>
                                        <td data-label="SKU">{variant?.sku || '—'}</td>
                                        <td>
                                          <Badge>{entry.type}</Badge>
                                        </td>
                                        <td class="numeric" data-label="On-hand change">
                                          {entry.onHandDelta > 0 ? '+' : ''}
                                          {entry.onHandDelta}
                                        </td>
                                        <td class="numeric" data-label="Unavailable change">
                                          {entry.unavailableDelta > 0 ? '+' : ''}
                                          {entry.unavailableDelta}
                                        </td>
                                        <td>{entry.notes || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </Table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <p class="empty">No purchase lots yet. Record a purchase amount and total units to get started.</p>
        )}
      </div>
      <Modal open={open} title={base.value ? 'Edit purchase lot' : 'New purchase lot'}>
        {open.value && <ReconnectNotice q:slot="notice" />}
        <EditorForm
          class="stack"
          preventdefault:submit
          onSubmit$={async () => {
            attempted.value = true;
            const row = {
              id: base.value?.id || makeId(),
              name: name.value.trim(),
              totalAmount: Number(amount.value),
              totalUnits: Number(units.value),
            };
            if (
              await onCommit$(
                [{ tab: 'Purchase Lots', row }],
                base.value ? [{ tab: 'Purchase Lots', row: base.value }] : [],
              )
            )
              open.value = false;
          }}
        >
          <label class="field">
            Lot name
            <Input
              required
              value={name.value}
              placeholder="e.g. November supplier purchase"
              onInput$={(_, el) => {
                name.value = el.value;
              }}
            />
          </label>
          <label class="field">
            Total purchase amount ({currency})
            <Input
              required
              type="number"
              min={0}
              step="0.01"
              value={amount.value}
              onInput$={(_, el) => {
                amount.value = el.value;
              }}
            />
          </label>
          <label class="field">
            Total purchased units
            <Input
              required
              type="number"
              min={1}
              step="1"
              value={units.value}
              onInput$={(_, el) => {
                units.value = el.value;
              }}
            />
          </label>
          {attempted.value && error && (
            <p class="notice error" role="alert">
              {error}
            </p>
          )}
          <ActionBar q:slot="actions" label="Purchase lot editor actions">
            <Button
              class="secondary"
              disabled={busy}
              onClick$={() => {
                open.value = false;
              }}
              icon="close"
              label="Cancel"
            />
            <Button type="submit" disabled={busy} icon="save" label="Save purchase lot" />
          </ActionBar>
        </EditorForm>
      </Modal>
    </Panel>
  );
});
