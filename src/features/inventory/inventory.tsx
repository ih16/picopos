import { createMediaQuery } from '@solid-primitives/media';
import { createMemo, createSignal, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { workbookNumberFormat } from '../../domain/settings';
import {
  getInventory,
  makeId,
  STOCK_TYPES,
  type RowChange,
  type StockEntry,
  type StockType,
  type WorkbookData,
} from '../../domain/workbook';
import {
  ActionBar,
  Badge,
  Button,
  EditorForm,
  Input,
  Modal,
  Panel,
  SelectField,
  Table,
} from '../../shared/ui/controls';
import { PagedRows } from '../../shared/ui/paged-rows';
import { Icon } from '../../shared/ui/icon';
import { ListFilters } from '../../shared/ui/list-filters';
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

type InventoryProps = {
  data: WorkbookData;
  busy: boolean;
  saveError?: string;
  onCommit: (changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>;
};

export function Inventory(props: InventoryProps) {
  const [showForm, setShowForm] = createSignal(false);
  const { route, navigate } = useContext(ScreenNavigation);
  const subpage = () => route().inventoryPage;
  const [lotId, setLotId] = createSignal('');
  const [lotEditor, setLotEditor] = createSignal(false);
  const [entryBase, setEntryBase] = createSignal<StockEntry>();
  const [search, setSearch] = createSignal('');
  const [variantId, setVariantId] = createSignal('');
  const [type, setType] = createSignal<StockType>('Receipt');
  const [adjustmentDirection, setAdjustmentDirection] = createSignal<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = createSignal('1');
  const [notes, setNotes] = createSignal('');
  const [validationError, setValidationError] = createSignal('');
  const [saveFailed, setSaveFailed] = createSignal(false);
  const balances = createMemo(() => getInventory(props.data));
  const totals = createMemo(() =>
    balances().reduce(
      (total, balance) => ({
        onHand: total.onHand + balance.onHand,
        reserved: total.reserved + balance.reserved,
        unavailable: total.unavailable + balance.unavailable,
        available: total.available + balance.available,
      }),
      { onHand: 0, reserved: 0, unavailable: 0, available: 0 },
    ),
  );

  const products = createMemo(() => new Map(props.data.Products.map((product) => [product.id, product])));
  const variants = createMemo(() =>
    props.data.Variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      image: products().get(variant.productId)?.image,
      label: [products().get(variant.productId)?.name || 'Product', variant.optionValues]
        .filter(Boolean)
        .join(' · '),
    })),
  );
  const variantsById = createMemo(() => new Map(variants().map((variant) => [variant.id, variant])));
  const query = createMemo(() => search().trim().toLowerCase().split(/\s+/).filter(Boolean));
  const matches = createMemo(
    () =>
      new Set(
        variants()
          .filter(({ label, sku }) => matchesSearch(label, sku, query()))
          .map(({ id }) => id),
      ),
  );
  const rows = createMemo(() => balances().filter((row) => matches().has(row.variantId)));
  const history = createMemo(() => {
    return props.data['Stock Entries']
      .filter((entry) => !query().length || matches().has(entry.variantId))
      .sort((a, b) => b.date.localeCompare(a.date));
  });
  const mobile = createMediaQuery('(max-width: 760px)');
  const selectedBalance = createMemo(() => balances().find((item) => item.variantId === variantId()));
  const amount = createMemo(() => Number(quantity()));
  const validAmount = createMemo(() => Number.isSafeInteger(amount()) && amount() > 0);
  const adjustedAmount = createMemo(() =>
    type() === 'Adjustment' && adjustmentDirection() === 'decrease' ? -amount() : amount(),
  );
  const changes = createMemo(() => (validAmount() ? stockChange(type(), adjustedAmount()) : undefined));
  const projected = createMemo(() => {
    const balance = selectedBalance();
    const delta = changes();
    return balance && delta
      ? {
          onHand: balance.onHand + delta.onHandDelta,
          reserved: balance.reserved,
          unavailable: balance.unavailable + delta.unavailableDelta,
          available: balance.available + delta.onHandDelta - delta.unavailableDelta,
        }
      : undefined;
  });

  const clearSearch = () => {
    setSearch('');
  };
  const startEntry = (id = '') => {
    setLotId('');
    setVariantId(id);
    setType('Receipt');
    setAdjustmentDirection('increase');
    setQuantity('1');
    setNotes('');
    setValidationError('');
    setSaveFailed(false);
    setShowForm(true);
  };

  const lotOptions = createMemo(() => [
    { value: '', label: 'No purchase lot' },
    ...props.data['Purchase Lots'].map((lot) => ({ value: lot.id, label: lot.name })),
  ]);
  const changeLot = (entry: StockEntry) => {
    setEntryBase({ ...entry });
    setLotId(entry.purchaseLotId || '');
    setSaveFailed(false);
    setLotEditor(true);
  };

  return (
    <section class={['stack inventory-page', subpage() === 'entries' && 'stock-entries-page']}>
      <h1 class="sr-only">Inventory</h1>
      <div class="catalog-toolbar inventory-toolbar">
        <nav class="row catalog-tabs" aria-label="Inventory pages">
          <Button
            class={subpage() === 'stock' ? '' : 'secondary'}
            aria-current={subpage() === 'stock' ? 'page' : undefined}
            onClick={() => navigate('/inventory')}
          >
            Stock
          </Button>
          <Button
            class={subpage() === 'entries' ? '' : 'secondary'}
            aria-current={subpage() === 'entries' ? 'page' : undefined}
            onClick={() => navigate('/inventory/entries')}
          >
            Stock entries
          </Button>
          <Button
            class={subpage() === 'lots' ? '' : 'secondary'}
            aria-current={subpage() === 'lots' ? 'page' : undefined}
            onClick={() => navigate('/inventory/lots')}
          >
            Purchase lots
          </Button>
        </nav>
        {subpage() !== 'lots' && (
          <ListFilters title="Filter inventory" count={Number(Boolean(query()))} class="catalog-filters">
            <label class="field catalog-search input-with-icon">
              <span class="sr-only">Search inventory</span>
              <Icon name="search" />
              <Input
                controlSize="sm"
                type="search"
                value={search()}
                placeholder="Product or SKU"
                onInput={(event) => {
                  const el = event.currentTarget;
                  setSearch(el.value);
                }}
              />
            </label>
            {query().length > 0 && (
              <Button class="secondary catalog-icon-button" aria-label="Clear search" onClick={clearSearch}>
                <Icon name="close" />
              </Button>
            )}
          </ListFilters>
        )}
      </div>
      {!showForm() && !lotEditor() && subpage() !== 'lots' && (
        <ActionBar class="record-shortcut" label="Inventory actions">
          <Button
            disabled={props.busy || !variants().length}
            onClick={() => startEntry()}
            icon="stock-in"
            label="Add stock entry"
          />
        </ActionBar>
      )}
      {subpage() === 'stock' && (
        <dl class="inventory-summary" aria-label="Stock totals across all variants">
          {STOCK_METRICS.map(({ key, label }) => (
            <div data-status={label}>
              <dt class="metric-label">{label}</dt>
              <dd class={['metric-value', totals()[key] < 0 && 'negative']}>
                {totals()[key].toLocaleString(workbookNumberFormat(props.data))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div class="inventory-dialogs">
        <Modal
          open={showForm()}
          onDismiss={() => setShowForm(false)}
          title="New stock entry"
          notice={showForm() && <ReconnectNotice />}
        >
          <EditorForm
            class="stack"
            onSubmit={async () => {
              setValidationError('');
              setSaveFailed(false);
              const units = Number(quantity());
              if (!Number.isSafeInteger(units) || units <= 0) {
                setValidationError('Enter a positive whole number of units.');
                return;
              }
              const signedUnits =
                type() === 'Adjustment' && adjustmentDirection() === 'decrease' ? -units : units;
              if (
                await props.onCommit([
                  {
                    tab: 'Stock Entries',
                    row: {
                      id: makeId(),
                      variantId: variantId(),
                      type: type(),
                      date: new Date().toISOString(),
                      ...stockChange(type(), signedUnits),
                      notes: notes().trim(),
                      purchaseLotId: lotId(),
                    },
                  },
                ])
              ) {
                setShowForm(false);
              } else {
                setSaveFailed(true);
              }
            }}
            actions={
              <ActionBar label="Editor actions">
                <Button
                  class="secondary"
                  onClick={() => setShowForm(false)}
                  disabled={props.busy}
                  icon="close"
                  label="Cancel"
                />
                <Button type="submit" disabled={props.busy} icon="save" label="Save entry" />
              </ActionBar>
            }
          >
            <div class="form-grid">
              <SelectField
                label="Variant"
                required
                value={variantId()}
                onChange={(value) => {
                  setVariantId(value);
                }}
                options={variants().map((variant) => ({
                  value: variant.id,
                  image: variant.image,
                  imageName: variant.label,
                  label: `${variant.sku} · ${variant.label}`,
                }))}
              />
              <SelectField
                label="Entry type"
                value={type()}
                describedBy="stock-entry-description"
                onChange={(value) => {
                  setType(value as StockType);
                  setValidationError('');
                }}
                options={STOCK_TYPES.map((value) => ({ value, label: value }))}
              />
              {type() === 'Adjustment' && (
                <SelectField
                  label="Direction"
                  value={adjustmentDirection()}
                  onChange={(value) => {
                    setAdjustmentDirection(value === 'decrease' ? 'decrease' : 'increase');
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
                  inputmode="numeric"
                  min={1}
                  step="1"
                  required
                  value={quantity()}
                  onInput={(event) => {
                    const el = event.currentTarget;
                    setQuantity(el.value);
                    setValidationError('');
                  }}
                />
              </label>
              <SelectField
                label="Purchase lot (optional)"
                value={lotId()}
                options={lotOptions()}
                onChange={(value) => {
                  setLotId(value);
                }}
              />
              <label class="field">
                Reason (optional)
                <Input
                  value={notes()}
                  onInput={(event) => {
                    setNotes(event.currentTarget.value);
                  }}
                  placeholder="e.g. Supplier delivery"
                />
              </label>
            </div>
            <p class="muted" id="stock-entry-description">
              {ENTRY_DETAILS[type()]}
            </p>
            {projected() && (
              <section class="notice stock-entry-preview" aria-label="Balance preview" aria-live="polite">
                <h3>After this entry</h3>
                <dl class="mobile-record-values">
                  {STOCK_METRICS.map(({ key, label }) => (
                    <div>
                      <dt>{label}</dt>
                      <dd class={projected()![key] < 0 ? 'negative' : undefined}>{projected()![key]}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {validationError() && (
              <p role="alert" class="notice error">
                {validationError()}
              </p>
            )}
            {saveFailed() && props.saveError && (
              <p role="alert" class="notice error">
                {props.saveError}
              </p>
            )}
          </EditorForm>
        </Modal>
        <Modal
          open={lotEditor()}
          onDismiss={() => setLotEditor(false)}
          title="Change purchase lot"
          notice={lotEditor() && <ReconnectNotice />}
        >
          <EditorForm
            class="stack"
            onSubmit={async () => {
              const entry = entryBase();
              if (!entry) return;
              setSaveFailed(false);
              if (
                await props.onCommit(
                  [{ tab: 'Stock Entries', row: { ...entry, purchaseLotId: lotId() } }],
                  [{ tab: 'Stock Entries', row: entry }],
                )
              )
                setLotEditor(false);
              else setSaveFailed(true);
            }}
            actions={
              <ActionBar label="Stock lot editor actions">
                <Button
                  class="secondary"
                  disabled={props.busy}
                  onClick={() => {
                    setLotEditor(false);
                  }}
                  icon="close"
                  label="Cancel"
                />
                <Button type="submit" disabled={props.busy} icon="save" label="Save lot link" />
              </ActionBar>
            }
          >
            <SelectField
              label="Purchase lot"
              value={lotId()}
              options={lotOptions()}
              onChange={(value) => {
                setLotId(value);
              }}
            />
            <p class="muted">Choose “No purchase lot” to remove the link.</p>
            {saveFailed() && props.saveError && (
              <p class="notice error" role="alert">
                {props.saveError}
              </p>
            )}
          </EditorForm>
        </Modal>
      </div>
      {subpage() === 'lots' && (
        <PurchaseLots data={props.data} busy={props.busy} error={props.saveError} onCommit={props.onCommit} />
      )}
      {subpage() === 'stock' && (
        <>
          <Panel class="stack" role="region" aria-label="Stock balances">
            <div class="component-scroll">
              {rows().length ? (
                !mobile() ? (
                  <Table
                    desktopOnly
                    class="scroll-rows paged-viewport stock-balances-table"
                    aria-label="Stock balances"
                  >
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
                    <PagedRows table rows={rows()} estimate={55} resetKey={search()}>
                      {(page) => (
                        <>
                          {page().map((row) => {
                            const variant = variantsById().get(row.variantId)!;
                            return (
                              <tr>
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
                                    disabled={props.busy}
                                    title="Add stock entry"
                                    aria-label={`Add stock entry for ${variant.sku}`}
                                    onClick={() => startEntry(row.variantId)}
                                  >
                                    <Icon name="plus" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </PagedRows>
                  </Table>
                ) : (
                  <ul class="mobile-records paged-viewport" aria-label="Stock balances">
                    <PagedRows list rows={rows()} estimate={128} resetKey={search()}>
                      {(page) => (
                        <>
                          {page().map((row) => {
                            const variant = variantsById().get(row.variantId)!;
                            return (
                              <li class="mobile-record">
                                <div class="mobile-record-head">
                                  <ProductLabel name={variant.label} image={variant.image}>
                                    <strong>{variant.label}</strong>
                                    <span class="inventory-row-meta sku muted">{variant.sku}</span>
                                  </ProductLabel>
                                  <Button
                                    class="secondary compact catalog-icon-button"
                                    disabled={props.busy}
                                    title="Add stock entry"
                                    aria-label={`Add stock entry for ${variant.sku}`}
                                    onClick={() => startEntry(row.variantId)}
                                  >
                                    <Icon name="plus" />
                                  </Button>
                                </div>
                                <dl class="mobile-record-values">
                                  {STOCK_METRICS.map(({ key, label }) => (
                                    <div>
                                      <dt>{label}</dt>
                                      <dd class={row[key] < 0 ? 'negative' : undefined}>{row[key]}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </li>
                            );
                          })}
                        </>
                      )}
                    </PagedRows>
                  </ul>
                )
              ) : (
                <div class="empty stack">
                  <p>
                    {balances().length
                      ? 'No products or SKUs match this search.'
                      : 'Add a product variant in Catalog to start tracking stock.'}
                  </p>
                  {query().length > 0 && (
                    <div>
                      <Button
                        class="secondary compact"
                        onClick={clearSearch}
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
      {subpage() === 'entries' && (
        <>
          <Panel class="stack" role="region" aria-label="Stock entries">
            <div class="component-scroll virtual-scroll">
              {history().length ? (
                !mobile() ? (
                  <Table
                    desktopOnly
                    class="scroll-rows paged-viewport stock-entries-table"
                    aria-label="Stock entries"
                  >
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
                    <PagedRows table rows={history()} estimate={55} resetKey={search()}>
                      {(page) => (
                        <>
                          {page().map((entry) => (
                            <tr data-virtual-id={entry.id}>
                              <td>{entry.date.slice(0, 10)}</td>
                              <td>
                                <ProductLabel
                                  name={variantsById().get(entry.variantId)?.label || 'Unknown variant'}
                                  image={variantsById().get(entry.variantId)?.image}
                                >
                                  {variantsById().get(entry.variantId)?.label || 'Unknown variant'}
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
                                {props.data['Purchase Lots'].find((lot) => lot.id === entry.purchaseLotId)
                                  ?.name || 'No purchase lot'}
                              </td>
                              <td class="table-actions">
                                <Button
                                  class="secondary compact catalog-icon-button"
                                  disabled={props.busy}
                                  title="Change purchase lot"
                                  aria-label={`Change purchase lot for ${variantsById().get(entry.variantId)?.label || 'stock entry'}`}
                                  onClick={() => changeLot(entry)}
                                >
                                  <Icon name="edit" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </PagedRows>
                  </Table>
                ) : (
                  <ul class="mobile-records paged-viewport virtual-records" aria-label="Stock entries">
                    <PagedRows list rows={history()} estimate={128} resetKey={search()}>
                      {(page) => (
                        <>
                          {page().map((entry) => (
                            <li class="stock-entry-row" data-virtual-id={entry.id}>
                              <article class="mobile-record stock-entry-card">
                                <div class="mobile-record-head">
                                  <ProductLabel
                                    name={variantsById().get(entry.variantId)?.label || 'Unknown variant'}
                                    image={variantsById().get(entry.variantId)?.image}
                                  >
                                    <strong>
                                      {variantsById().get(entry.variantId)?.label || 'Unknown variant'}
                                    </strong>
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
                                <div class="stock-entry-lot">
                                  <span>
                                    {props.data['Purchase Lots'].find((lot) => lot.id === entry.purchaseLotId)
                                      ?.name || 'No purchase lot'}
                                  </span>
                                  <Button
                                    class="secondary compact catalog-icon-button"
                                    disabled={props.busy}
                                    title="Change purchase lot"
                                    aria-label={`Change purchase lot for ${variantsById().get(entry.variantId)?.label || 'stock entry'}`}
                                    onClick={() => changeLot(entry)}
                                  >
                                    <Icon name="edit" />
                                  </Button>
                                </div>
                              </article>
                            </li>
                          ))}
                        </>
                      )}
                    </PagedRows>
                  </ul>
                )
              ) : (
                <p class="empty">
                  {query().length && props.data['Stock Entries'].length
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
}
