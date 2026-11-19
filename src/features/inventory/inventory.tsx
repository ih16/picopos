import { workbookNumberFormat } from '../../domain/settings';
import { $, component$, useComputed$, useContext, useSignal, useTask$, type QRL } from '@builder.io/qwik';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import {
  getInventory,
  makeId,
  STOCK_TYPES,
  type RowChange,
  type StockEntry,
  type StockType,
  type WorkbookData,
} from '../../domain/workbook';
import { useVirtualScroll } from '../../shared/hooks/use-virtual-scroll';
import {
  ActionBar,
  EditorForm,
  Badge,
  Button,
  Input,
  Modal,
  Panel,
  SelectField,
  Table,
} from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductLabel } from '../../shared/ui/product-thumbnail';
import { ReconnectNotice } from '../auth/connection';
import { PurchaseLots } from './purchase-lots';

const STOCK_METRICS = [
  { key: 'onHand', label: 'On hand' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'unavailable', label: 'Unavailable' },
  { key: 'available', label: 'Available' },
] as const;

const ENTRY_DETAILS: Record<StockType, string> = {
  'Opening stock': 'Add the units you already have when setting up this SKU.',
  Receipt: 'Add units received from a supplier or shipment.',
  Adjustment: 'Choose whether to add or remove units from on-hand stock.',
  Damaged: 'Move on-hand units from available to unavailable.',
  Restocked: 'Move unavailable units back to available stock.',
};

function stockChange(type: StockType, amount: number) {
  if (type === 'Damaged') return { onHandDelta: 0, unavailableDelta: amount };
  if (type === 'Restocked') return { onHandDelta: 0, unavailableDelta: -amount };
  return { onHandDelta: amount, unavailableDelta: 0 };
}

function matchesSearch(label: string, sku: string, query: string[]) {
  const searchable = `${label} ${sku}`.toLowerCase();
  return query.every((word) => searchable.includes(word));
}

function signedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}

export const Inventory = component$<{
  data: WorkbookData;
  busy: boolean;
  saveError?: string;
  onCommit$: QRL<(changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>>;
}>(({ data, busy, saveError, onCommit$ }) => {
  const showForm = useSignal(false);
  const { route, navigate$ } = useContext(ScreenNavigation);
  const subpage = useSignal<'stock' | 'entries' | 'lots'>('stock');
  useTask$(({ track }) => {
    const screen = track(() => route.value);
    if (screen.page === 'Inventory') subpage.value = screen.inventoryPage;
  });
  const lotId = useSignal('');
  const lotEditor = useSignal(false);
  const entryBase = useSignal<StockEntry>();
  const search = useSignal('');
  const variantId = useSignal('');
  const type = useSignal<StockType>('Receipt');
  const adjustmentDirection = useSignal<'increase' | 'decrease'>('increase');
  const quantity = useSignal('1');
  const notes = useSignal('');
  const validationError = useSignal('');
  const saveFailed = useSignal(false);
  const balances = useComputed$(() => getInventory(data));
  const totals = useComputed$(() =>
    balances.value.reduce(
      (total, balance) => ({
        onHand: total.onHand + balance.onHand,
        reserved: total.reserved + balance.reserved,
        unavailable: total.unavailable + balance.unavailable,
        available: total.available + balance.available,
      }),
      { onHand: 0, reserved: 0, unavailable: 0, available: 0 },
    ),
  );

  const products = new Map(data.Products.map((product) => [product.id, product]));
  const variants = data.Variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    image: products.get(variant.productId)?.image,
    label: [products.get(variant.productId)?.name || 'Product', variant.optionValues]
      .filter(Boolean)
      .join(' · '),
  }));
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const query = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = new Set(
    variants.filter(({ label, sku }) => matchesSearch(label, sku, query)).map(({ id }) => id),
  );
  const rows = balances.value.filter((row) => matches.has(row.variantId));
  const history = useComputed$(() => {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matchingVariants = new Set(
      data.Variants.filter((variant) => {
        const product = data.Products.find((row) => row.id === variant.productId);
        return matchesSearch(`${product?.name || 'Product'} ${variant.optionValues}`, variant.sku, words);
      }).map((variant) => variant.id),
    );
    return data['Stock Entries']
      .filter((entry) => !words.length || matchingVariants.has(entry.variantId))
      .sort((a, b) => b.date.localeCompare(a.date));
  });
  const historyScroll = useVirtualScroll(useComputed$(() => history.value.map((entry) => entry.id)));
  const historyRows = history.value.slice(historyScroll.range.value.start, historyScroll.range.value.end);

  const selectedBalance = balances.value.find((item) => item.variantId === variantId.value);
  const amount = Number(quantity.value);
  const validAmount = Number.isSafeInteger(amount) && amount > 0;
  const adjustedAmount =
    type.value === 'Adjustment' && adjustmentDirection.value === 'decrease' ? -amount : amount;
  const changes = validAmount ? stockChange(type.value, adjustedAmount) : undefined;
  const projected =
    selectedBalance && changes
      ? {
          onHand: selectedBalance.onHand + changes.onHandDelta,
          reserved: selectedBalance.reserved,
          unavailable: selectedBalance.unavailable + changes.unavailableDelta,
          available: selectedBalance.available + changes.onHandDelta - changes.unavailableDelta,
        }
      : undefined;

  const clearSearch = $(() => {
    search.value = '';
  });
  const startEntry = $((id = '') => {
    lotId.value = '';
    variantId.value = id;
    type.value = 'Receipt';
    adjustmentDirection.value = 'increase';
    quantity.value = '1';
    notes.value = '';
    validationError.value = '';
    saveFailed.value = false;
    showForm.value = true;
  });

  const lotOptions = [
    { value: '', label: 'No purchase lot' },
    ...data['Purchase Lots'].map((lot) => ({ value: lot.id, label: lot.name })),
  ];
  const changeLot = $((entry: StockEntry) => {
    entryBase.value = { ...entry };
    lotId.value = entry.purchaseLotId || '';
    saveFailed.value = false;
    lotEditor.value = true;
  });

  return (
    <section class="stack inventory-page">
      <h1 class="sr-only">Inventory</h1>
      <div class="catalog-toolbar inventory-toolbar">
        <nav class="row catalog-tabs" aria-label="Inventory pages">
          <Button
            class={subpage.value === 'stock' ? '' : 'secondary'}
            aria-current={subpage.value === 'stock' ? 'page' : undefined}
            onClick$={() => navigate$('/inventory')}
          >
            Stock
          </Button>
          <Button
            class={subpage.value === 'entries' ? '' : 'secondary'}
            aria-current={subpage.value === 'entries' ? 'page' : undefined}
            onClick$={() => navigate$('/inventory/entries')}
          >
            Stock entries
          </Button>
          <Button
            class={subpage.value === 'lots' ? '' : 'secondary'}
            aria-current={subpage.value === 'lots' ? 'page' : undefined}
            onClick$={() => navigate$('/inventory/lots')}
          >
            Purchase lots
          </Button>
        </nav>
        {subpage.value !== 'lots' && (
          <div class="row filters catalog-filters">
            <label class="field catalog-search input-with-icon">
              <span class="sr-only">Search inventory</span>
              <Icon name="search" />
              <Input
                controlSize="sm"
                type="search"
                value={search.value}
                placeholder="Product or SKU"
                onInput$={(_, el) => {
                  search.value = el.value;
                }}
              />
            </label>
            {query.length > 0 && (
              <Button class="secondary catalog-icon-button" aria-label="Clear search" onClick$={clearSearch}>
                <Icon name="close" />
              </Button>
            )}
          </div>
        )}
      </div>
      {!showForm.value && !lotEditor.value && subpage.value !== 'lots' && (
        <ActionBar class="record-shortcut" label="Inventory actions">
          <Button
            disabled={busy || !variants.length}
            onClick$={() => startEntry()}
            icon="stock-in"
            label="Add stock entry"
          />
        </ActionBar>
      )}
      {subpage.value === 'stock' && (
        <dl class="inventory-summary" aria-label="Stock totals across all variants">
          {STOCK_METRICS.map(({ key, label }) => (
            <div data-status={label} key={key}>
              <dt class="metric-label">{label}</dt>
              <dd class={['metric-value', totals.value[key] < 0 && 'negative']}>
                {totals.value[key].toLocaleString(workbookNumberFormat(data))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div class="inventory-dialogs">
        <Modal open={showForm} title="New stock entry">
          {showForm.value && <ReconnectNotice q:slot="notice" />}
          <EditorForm
            class="stack"
            preventdefault:submit
            onSubmit$={async () => {
              validationError.value = '';
              saveFailed.value = false;
              const units = Number(quantity.value);
              if (!Number.isSafeInteger(units) || units <= 0) {
                validationError.value = 'Enter a positive whole number of units.';
                return;
              }
              const signedUnits =
                type.value === 'Adjustment' && adjustmentDirection.value === 'decrease' ? -units : units;
              if (
                await onCommit$([
                  {
                    tab: 'Stock Entries',
                    row: {
                      id: makeId(),
                      variantId: variantId.value,
                      type: type.value,
                      date: new Date().toISOString(),
                      ...stockChange(type.value, signedUnits),
                      notes: notes.value.trim(),
                      purchaseLotId: lotId.value,
                    },
                  },
                ])
              ) {
                showForm.value = false;
              } else {
                saveFailed.value = true;
              }
            }}
          >
            <div class="form-grid">
              <SelectField
                label="Variant"
                required
                value={variantId.value}
                onChange$={(value) => {
                  variantId.value = value;
                }}
                options={variants.map((variant) => ({
                  value: variant.id,
                  image: variant.image,
                  imageName: variant.label,
                  label: `${variant.sku} · ${variant.label}`,
                }))}
              />
              <SelectField
                label="Entry type"
                value={type.value}
                describedBy="stock-entry-description"
                onChange$={(value) => {
                  type.value = value as StockType;
                  validationError.value = '';
                }}
                options={STOCK_TYPES.map((value) => ({ value, label: value }))}
              />
              {type.value === 'Adjustment' && (
                <SelectField
                  label="Direction"
                  value={adjustmentDirection.value}
                  onChange$={(value) => {
                    adjustmentDirection.value = value === 'decrease' ? 'decrease' : 'increase';
                  }}
                  options={[
                    { value: 'increase', label: 'Add to on hand' },
                    { value: 'decrease', label: 'Remove from on hand' },
                  ]}
                />
              )}
              <label class="field">
                Quantity
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step="1"
                  required
                  value={quantity.value}
                  onInput$={(_, el) => {
                    quantity.value = el.value;
                    validationError.value = '';
                  }}
                />
              </label>
              <SelectField
                label="Purchase lot (optional)"
                value={lotId.value}
                options={lotOptions}
                onChange$={(value) => {
                  lotId.value = value;
                }}
              />
              <label class="field">
                Reason (optional)
                <Input
                  value={notes.value}
                  onInput$={(_, el) => (notes.value = el.value)}
                  placeholder="e.g. Supplier delivery"
                />
              </label>
            </div>
            <p class="muted" id="stock-entry-description">
              {ENTRY_DETAILS[type.value]}
            </p>
            {projected && (
              <section class="notice stock-entry-preview" aria-label="Balance preview" aria-live="polite">
                <h3>After this entry</h3>
                <dl class="mobile-record-values">
                  {STOCK_METRICS.map(({ key, label }) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd class={projected[key] < 0 ? 'negative' : undefined}>{projected[key]}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {validationError.value && (
              <p role="alert" class="notice error">
                {validationError.value}
              </p>
            )}
            {saveFailed.value && saveError && (
              <p role="alert" class="notice error">
                {saveError}
              </p>
            )}
            <ActionBar q:slot="actions" label="Editor actions">
              <Button
                class="secondary"
                onClick$={() => (showForm.value = false)}
                disabled={busy}
                icon="close"
                label="Cancel"
              />
              <Button type="submit" disabled={busy} icon="save" label="Save entry" />
            </ActionBar>
          </EditorForm>
        </Modal>
        <Modal open={lotEditor} title="Change purchase lot">
          {lotEditor.value && <ReconnectNotice q:slot="notice" />}
          <EditorForm
            class="stack"
            preventdefault:submit
            onSubmit$={async () => {
              const entry = entryBase.value;
              if (!entry) return;
              saveFailed.value = false;
              if (
                await onCommit$(
                  [{ tab: 'Stock Entries', row: { ...entry, purchaseLotId: lotId.value } }],
                  [{ tab: 'Stock Entries', row: entry }],
                )
              )
                lotEditor.value = false;
              else saveFailed.value = true;
            }}
          >
            <SelectField
              label="Purchase lot"
              value={lotId.value}
              options={lotOptions}
              onChange$={(value) => {
                lotId.value = value;
              }}
            />
            <p class="muted">Choose “No purchase lot” to remove the link.</p>
            {saveFailed.value && saveError && (
              <p class="notice error" role="alert">
                {saveError}
              </p>
            )}
            <ActionBar q:slot="actions" label="Stock lot editor actions">
              <Button
                class="secondary"
                disabled={busy}
                onClick$={() => {
                  lotEditor.value = false;
                }}
                icon="close"
                label="Cancel"
              />
              <Button type="submit" disabled={busy} icon="save" label="Save lot link" />
            </ActionBar>
          </EditorForm>
        </Modal>
      </div>
      {subpage.value === 'lots' && (
        <PurchaseLots data={data} busy={busy} error={saveError} onCommit$={onCommit$} />
      )}
      {subpage.value === 'stock' && (
        <>
          <Panel class="stack" role="region" aria-label="Stock balances">
            <div class="component-scroll">
              {rows.length ? (
                <>
                  <Table desktopOnly class="scroll-rows stock-balances-table" aria-label="Stock balances">
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col" class="numeric">
                          On hand
                        </th>
                        <th scope="col" class="numeric">
                          Reserved
                        </th>
                        <th scope="col" class="numeric">
                          Unavailable
                        </th>
                        <th scope="col" class="numeric">
                          Available
                        </th>
                        <th scope="col" class="table-actions">
                          <span class="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const variant = variantsById.get(row.variantId)!;
                        return (
                          <tr key={row.variantId}>
                            <th scope="row">
                              <ProductLabel name={variant.label} image={variant.image}>
                                {variant.label}
                                <span class="inventory-row-meta sku">{variant.sku}</span>
                              </ProductLabel>
                            </th>
                            <td class="numeric">{row.onHand}</td>
                            <td class="numeric">{row.reserved}</td>
                            <td class="numeric">{row.unavailable}</td>
                            <td class={['numeric', row.available < 0 && 'negative']}>
                              <strong>{row.available}</strong>
                            </td>
                            <td class="table-actions">
                              <Button
                                class="secondary compact catalog-icon-button"
                                disabled={busy}
                                title="Add stock entry"
                                aria-label={`Add stock entry for ${variant.sku}`}
                                onClick$={() => startEntry(row.variantId)}
                              >
                                <Icon name="plus" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  <ul class="mobile-records" aria-label="Stock balances">
                    {rows.map((row) => {
                      const variant = variantsById.get(row.variantId)!;
                      return (
                        <li class="mobile-record" key={row.variantId}>
                          <div class="mobile-record-head">
                            <ProductLabel name={variant.label} image={variant.image}>
                              <strong>{variant.label}</strong>
                              <span class="inventory-row-meta sku muted">{variant.sku}</span>
                            </ProductLabel>
                            <Button
                              class="secondary compact catalog-icon-button"
                              disabled={busy}
                              title="Add stock entry"
                              aria-label={`Add stock entry for ${variant.sku}`}
                              onClick$={() => startEntry(row.variantId)}
                            >
                              <Icon name="plus" />
                            </Button>
                          </div>
                          <dl class="mobile-record-values">
                            {STOCK_METRICS.map(({ key, label }) => (
                              <div key={key}>
                                <dt>{label}</dt>
                                <dd class={row[key] < 0 ? 'negative' : undefined}>{row[key]}</dd>
                              </div>
                            ))}
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div class="empty stack">
                  <p>
                    {balances.value.length
                      ? 'No products or SKUs match this search.'
                      : 'Add a product variant in Catalog to start tracking stock.'}
                  </p>
                  {query.length > 0 && (
                    <div>
                      <Button
                        class="secondary compact"
                        onClick$={clearSearch}
                        icon="close"
                        label="Clear search"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </>
      )}
      {subpage.value === 'entries' && (
        <>
          <Panel class="stack" role="region" aria-label="Stock entries">
            <div class="component-scroll virtual-scroll" ref={historyScroll.container}>
              {historyRows.length ? (
                <>
                  <Table desktopOnly class="scroll-rows stock-entries-table" aria-label="Stock entries">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Variant</th>
                        <th scope="col">Entry</th>
                        <th scope="col" class="numeric">
                          Stock change
                        </th>
                        <th scope="col">Purchase lot</th>
                        <th scope="col" class="table-actions">
                          <span class="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody ref={historyScroll.tableBody}>
                      <tr aria-hidden="true" class="virtual-spacer">
                        <td colSpan={6} style={{ height: `${historyScroll.range.value.before}px` }} />
                      </tr>
                      {historyRows.map((entry) => (
                        <tr key={entry.id} data-virtual-id={entry.id}>
                          <td>{entry.date.slice(0, 10)}</td>
                          <td>
                            <ProductLabel
                              name={variantsById.get(entry.variantId)?.label || 'Unknown variant'}
                              image={variantsById.get(entry.variantId)?.image}
                            >
                              {variantsById.get(entry.variantId)?.label || 'Unknown variant'}
                            </ProductLabel>
                          </td>
                          <td>
                            <Badge>{entry.type}</Badge>
                            {entry.notes && <span class="inventory-row-meta">{entry.notes}</span>}
                          </td>
                          <td class="numeric">
                            {signedQuantity(entry.onHandDelta)}
                            <span class="inventory-row-meta">on hand</span>
                            {entry.unavailableDelta !== 0 && (
                              <span class="inventory-row-meta">
                                {signedQuantity(entry.unavailableDelta)} unavailable
                              </span>
                            )}
                          </td>
                          <td>
                            {data['Purchase Lots'].find((lot) => lot.id === entry.purchaseLotId)?.name ||
                              'No purchase lot'}
                          </td>
                          <td class="table-actions">
                            <Button
                              class="secondary compact catalog-icon-button"
                              disabled={busy}
                              title="Change purchase lot"
                              aria-label={`Change purchase lot for ${variantsById.get(entry.variantId)?.label || 'stock entry'}`}
                              onClick$={() => changeLot(entry)}
                            >
                              <Icon name="edit" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr aria-hidden="true" class="virtual-spacer">
                        <td colSpan={6} style={{ height: `${historyScroll.range.value.after}px` }} />
                      </tr>
                    </tbody>
                  </Table>
                  <ul class="mobile-records virtual-records" aria-label="Stock entries">
                    <li aria-hidden="true" style={{ height: `${historyScroll.range.value.before}px` }} />
                    {historyRows.map((entry) => (
                      <li class="mobile-record" key={entry.id} data-virtual-id={entry.id}>
                        <div class="mobile-record-head">
                          <ProductLabel
                            name={variantsById.get(entry.variantId)?.label || 'Unknown variant'}
                            image={variantsById.get(entry.variantId)?.image}
                          >
                            <strong>{variantsById.get(entry.variantId)?.label || 'Unknown variant'}</strong>
                            <span class="inventory-row-meta muted">{entry.date.slice(0, 10)}</span>
                          </ProductLabel>
                          <Badge>{entry.type}</Badge>
                        </div>
                        <dl class="mobile-record-values">
                          <div>
                            <dt>On-hand change</dt>
                            <dd>{signedQuantity(entry.onHandDelta)}</dd>
                          </div>
                          <div>
                            <dt>Unavailable change</dt>
                            <dd>{signedQuantity(entry.unavailableDelta)}</dd>
                          </div>
                        </dl>
                        {entry.notes && <p>{entry.notes}</p>}
                        <div class="row">
                          <span>
                            {data['Purchase Lots'].find((lot) => lot.id === entry.purchaseLotId)?.name ||
                              'No purchase lot'}
                          </span>
                          <Button
                            class="secondary compact catalog-icon-button"
                            disabled={busy}
                            title="Change purchase lot"
                            aria-label={`Change purchase lot for ${variantsById.get(entry.variantId)?.label || 'stock entry'}`}
                            onClick$={() => changeLot(entry)}
                          >
                            <Icon name="edit" />
                          </Button>
                        </div>
                      </li>
                    ))}
                    <li aria-hidden="true" style={{ height: `${historyScroll.range.value.after}px` }} />
                  </ul>
                </>
              ) : (
                <p class="empty">
                  {query.length && data['Stock Entries'].length
                    ? 'No stock entries match this search.'
                    : 'No stock entries yet.'}
                </p>
              )}
            </div>
          </Panel>
        </>
      )}
    </section>
  );
});
