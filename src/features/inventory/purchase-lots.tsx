import { createMemo, createSignal } from 'solid-js';

import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import {
  makeId,
  purchaseLotSummary,
  type PurchaseLot,
  type RowChange,
  type WorkbookData,
} from '../../domain/workbook';
import { decimalAmount } from '../../shared/lib/format';
import { SortableTable } from '../../shared/ui/sortable-table';
import { ActionBar, Badge, Button, EditorForm, Input, Modal, Panel } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductLabel } from '../../shared/ui/product-thumbnail';
import { ReconnectNotice } from '../auth/connection';

type PurchaseLotsProps = {
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit: (changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>;
};

export function PurchaseLots(props: PurchaseLotsProps) {
  const [open, setOpen] = createSignal(false);
  const [expandedLots, setExpandedLots] = createSignal<string[]>([]);
  const [base, setBase] = createSignal<PurchaseLot>();
  const [name, setName] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [units, setUnits] = createSignal('');
  const [attempted, setAttempted] = createSignal(false);
  const entryLabel = (variantId: string) => {
    const variant = props.data.Variants.find((row) => row.id === variantId);
    const product = props.data.Products.find((row) => row.id === variant?.productId);
    return [product?.name || 'Unknown product', variant?.optionValues].filter(Boolean).join(' · ');
  };
  const lotStatus = (difference: number) =>
    difference === 0
      ? 'Count matches'
      : difference > 0
        ? `${difference} units remaining`
        : `${-difference} units over`;
  const edit = (lot?: PurchaseLot) => {
    setBase(lot ? { ...lot } : undefined);
    setName(lot?.name ?? '');
    setAmount(lot ? String(lot.totalAmount) : '');
    setUnits(lot ? String(lot.totalUnits) : '');
    setAttempted(false);
    setOpen(true);
  };
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));
  return (
    <Panel class="stack" role="region" aria-label="Purchase lots">
      {!open() && (
        <ActionBar class="record-shortcut" label="Purchase lot actions">
          <Button disabled={props.busy} onClick={() => edit()} icon="lot-add" label="Add purchase lot" />
        </ActionBar>
      )}
      <div class="component-scroll">
        {props.data['Purchase Lots'].length ? (
          <SortableTable
            class="scroll-rows purchase-lots-table"
            aria-label="Purchase lots"
            rows={props.data['Purchase Lots']}
            estimate={55}
            columns={[
              { label: 'Purchase lot', value: (r) => r.name },
              { label: `Total purchase (${currency()})`, value: (r) => r.totalAmount, class: 'numeric' },
              { label: 'Purchased units', value: (r) => r.totalUnits, class: 'numeric' },
              {
                label: 'Linked units',
                value: (r) => purchaseLotSummary(props.data, r.id).units,
                class: 'numeric',
              },
              {
                label: `Average cost / unit (${currency()})`,
                value: (r) => r.totalAmount / r.totalUnits,
                class: 'numeric',
              },
              {
                label: 'Status',
                value: (r) => lotStatus(r.totalUnits - purchaseLotSummary(props.data, r.id).units),
              },
              {
                label: 'Stock entries',
                value: (r) =>
                  props.data['Stock Entries'].filter((entry) => entry.purchaseLotId === r.id).length,
              },
              { label: 'Actions', class: 'table-actions' },
            ]}
          >
            {(page) => (
              <>
                {page().map((lot) => {
                  const summary = purchaseLotSummary(props.data, lot.id);
                  const difference = lot.totalUnits - summary.units;
                  const entries = props.data['Stock Entries']
                    .filter((entry) => entry.purchaseLotId === lot.id)
                    .sort((a, b) => b.date.localeCompare(a.date));
                  const expanded = expandedLots().includes(lot.id);
                  return (
                    <>
                      <tr>
                        <td>
                          <strong>{lot.name}</strong>
                        </td>
                        <td class="numeric" data-label={`Purchase (${currency()})`}>
                          {decimalAmount(lot.totalAmount, numberFormat())}
                        </td>
                        <td class="numeric" data-label="Purchased units">
                          {lot.totalUnits}
                        </td>
                        <td class="numeric" data-label="Linked units">
                          {summary.units}
                        </td>
                        <td class="numeric" data-label={`Cost per unit (${currency()})`}>
                          {decimalAmount(lot.totalAmount / lot.totalUnits, numberFormat())}
                        </td>
                        <td>
                          <Badge>{lotStatus(difference)}</Badge>
                        </td>
                        <td>
                          {entries.length ? (
                            <Button
                              class="secondary compact variant-toggle"
                              title={expanded ? 'Hide stock entries' : 'Show stock entries'}
                              aria-label={`Stock entries for ${lot.name}`}
                              aria-expanded={expanded ? 'true' : 'false'}
                              aria-controls={`lot-entries-${lot.id}`}
                              onClick={() => {
                                setExpandedLots(
                                  expandedLots().includes(lot.id)
                                    ? expandedLots().filter((id) => id !== lot.id)
                                    : [...expandedLots(), lot.id],
                                );
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
                            disabled={props.busy}
                            title="Edit purchase lot"
                            aria-label={`Edit purchase lot ${lot.name}`}
                            onClick={() => edit(lot)}
                          >
                            <Icon name="edit" />
                          </Button>
                        </td>
                      </tr>
                      {entries.length > 0 && (
                        <tr id={`lot-entries-${lot.id}`} hidden={!expanded}>
                          <td colspan={8}>
                            {expanded && (
                              <div class="stack">
                                <p class="muted">
                                  Sales do not change linked units. Average cost is estimated across all
                                  purchased units.
                                </p>
                                <SortableTable
                                  class="lot-entry-table"
                                  aria-label={`Stock entries for ${lot.name}`}
                                  rows={entries}
                                  estimate={52}
                                  columns={[
                                    { label: 'Date', value: (r) => r.date },
                                    { label: 'Variant', value: (r) => entryLabel(r.variantId) },
                                    {
                                      label: 'SKU',
                                      value: (r) =>
                                        props.data.Variants.find((v) => v.id === r.variantId)?.sku || '',
                                    },
                                    { label: 'Entry', value: (r) => r.type },
                                    {
                                      label: 'On-hand change',
                                      value: (r) => r.onHandDelta,
                                      class: 'numeric',
                                    },
                                    {
                                      label: 'Unavailable change',
                                      value: (r) => r.unavailableDelta,
                                      class: 'numeric',
                                    },
                                    { label: 'Notes', value: (r) => r.notes || '' },
                                  ]}
                                >
                                  {(page) => (
                                    <>
                                      {page().map((entry) => {
                                        const variant = props.data.Variants.find(
                                          (row) => row.id === entry.variantId,
                                        );
                                        const product = props.data.Products.find(
                                          (row) => row.id === variant?.productId,
                                        );
                                        return (
                                          <tr>
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
                                    </>
                                  )}
                                </SortableTable>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </>
            )}
          </SortableTable>
        ) : (
          <p class="empty">No purchase lots yet. Record a purchase amount and total units to get started.</p>
        )}
      </div>
      <Modal
        open={open()}
        onDismiss={() => setOpen(false)}
        title={base() ? 'Edit purchase lot' : 'New purchase lot'}
        notice={open() && <ReconnectNotice />}
      >
        <EditorForm
          class="stack"
          onSubmit={async () => {
            setAttempted(true);
            const previous = base();
            const row = {
              id: base()?.id || makeId(),
              name: name().trim(),
              totalAmount: Number(amount()),
              totalUnits: Number(units()),
            };
            if (
              await props.onCommit(
                [{ tab: 'Purchase Lots', row }],
                previous ? [{ tab: 'Purchase Lots', row: previous }] : [],
              )
            )
              setOpen(false);
          }}
          actions={
            <ActionBar label="Purchase lot editor actions">
              <Button
                class="secondary"
                disabled={props.busy}
                onClick={() => {
                  setOpen(false);
                }}
                icon="close"
                label="Cancel"
              />
              <Button type="submit" disabled={props.busy} icon="save" label="Save purchase lot" />
            </ActionBar>
          }
        >
          <label class="field">
            Lot name
            <Input
              required
              value={name()}
              placeholder="e.g. November supplier purchase"
              onInput={(event) => {
                const el = event.currentTarget;
                setName(el.value);
              }}
            />
          </label>
          <label class="field">
            Total purchase amount ({currency()})
            <Input
              required
              type="number"
              min={0}
              step="0.01"
              value={amount()}
              onInput={(event) => {
                const el = event.currentTarget;
                setAmount(el.value);
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
              value={units()}
              onInput={(event) => {
                const el = event.currentTarget;
                setUnits(el.value);
              }}
            />
          </label>
          {attempted() && props.error && (
            <p class="notice error" role="alert">
              {props.error}
            </p>
          )}
        </EditorForm>
      </Modal>
    </Panel>
  );
}
