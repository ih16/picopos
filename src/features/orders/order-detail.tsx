import { createMemo, createSignal, For } from 'solid-js';

import { lineSubtotal, orderSubtotal, orderTotal } from '../../domain/order-totals';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import type { Order, OrderStatus, ReturnCondition, Return as ReturnEntry } from '../../domain/workbook';
import {
  getInventory,
  isShipped,
  makeId,
  NEXT_STATUSES,
  PAYMENT_STATUSES,
  RETURN_CONDITIONS,
} from '../../domain/workbook';
import { money } from '../../shared/lib/format';
import { PagedRows } from '../../shared/ui/paged-rows';
import { ActionBar, Badge, Button, Input, Panel, SelectField, Table } from '../../shared/ui/controls';
import { ProductLabel } from '../../shared/ui/product-thumbnail';
import { countRemaining, dateLabel, indexOrderRows, quantityLabel, returnLabel } from './order-helpers';
import type { OrdersProps } from './order-types';
import { ReceiveReturn } from './receive-return';

const statusLabels: Record<OrderStatus, string> = {
  Draft: 'Draft',
  'In progress': 'Confirm order',
  Shipped: 'Mark shipped',
  Completed: 'Mark completed',
  Cancelled: 'Cancel order',
};

type OrderDetailProps = OrdersProps & { order: Order };

export function OrderDetail(props: OrderDetailProps) {
  const [error, setError] = createSignal('');
  const [returning, setReturning] = createSignal(false);
  const [returnItemId, setReturnItemId] = createSignal('');
  const [returnQuantity, setReturnQuantity] = createSignal(1);
  const [returnCondition, setReturnCondition] = createSignal<ReturnCondition>('Sellable');
  const [returnNotes, setReturnNotes] = createSignal('');
  const [receiveNow, setReceiveNow] = createSignal(false);
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));
  const orderIndex = createMemo(() => indexOrderRows(props.data));
  const products = createMemo(() => new Map(props.data.Products.map((product) => [product.id, product])));
  const variants = createMemo(() => new Map(props.data.Variants.map((variant) => [variant.id, variant])));
  const items = createMemo(() => orderIndex().itemsByOrder.get(props.order.id) ?? []);
  const itemById = createMemo(() => new Map(items().map((item) => [item.id, item])));
  const returns = createMemo(() => orderIndex().returnsByOrder.get(props.order.id) ?? []);
  const returnableItems = createMemo(() => items().filter((item) => countRemaining(item, returns()) > 0));
  const remainingQuantity = createMemo(() => {
    const item = returnableItems().find((item) => item.id === returnItemId());
    return item ? countRemaining(item, returns()) : undefined;
  });
  const canReturn = createMemo(() => isShipped(props.order.status));

  const returnStatus = createMemo(() => returnLabel(items(), returns()));
  const subtotal = createMemo(() => orderSubtotal(items()));
  const shortage = createMemo(() => {
    if (props.order.status !== 'Draft') return false;
    const balances = new Map(getInventory(props.data).map((entry) => [entry.variantId, entry]));
    const totals = new Map<string, number>();
    for (const item of items()) totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity);
    return [...totals].some(([id, quantity]) => quantity > (balances.get(id)?.available ?? 0));
  });

  return (
    <div class="stack record-page order-detail-page">
      <div class="order-header">
        <div class="order-header-details">
          <h1>{props.order.number}</h1>
          <div class="row order-header-meta">
            <p class="muted">Created {dateLabel(props.order.createdAt)}</p>
            <Badge status={props.order.status}>{props.order.status}</Badge>
            {returnStatus() && <Badge status={returnStatus()}>{returnStatus()}</Badge>}
          </div>
        </div>
        {!returning() && (
          <ActionBar label="Order actions">
            {NEXT_STATUSES[props.order.status].map((status) => (
              <Button
                type="button"
                class={status === 'Cancelled' ? 'secondary danger' : 'primary'}
                disabled={
                  props.busy ||
                  (status === 'In progress' && (!items().length || shortage())) ||
                  (status === 'Shipped' && !items().length)
                }
                onClick={async () => {
                  await props.onCommit(
                    [{ tab: 'Orders', row: { ...props.order, status } }],
                    [{ tab: 'Orders', row: props.order }],
                  );
                }}
              >
                {statusLabels[status]}
              </Button>
            ))}
            {canReturn() && returnableItems().length > 0 && !returning() && (
              <Button
                type="button"
                class="secondary return-shortcut"
                disabled={props.busy}
                onClick={(event) => {
                  const button = event.currentTarget;
                  const section = button.closest('.order-detail-page')?.querySelector('.detail-returns');
                  setReturnItemId('');
                  setReturnQuantity(1);
                  setReturnCondition('Sellable');
                  setReturnNotes('');
                  setReceiveNow(false);
                  setError('');
                  setReturning(true);
                  if (matchMedia('(max-width: 760px)').matches)
                    requestAnimationFrame(() => section?.scrollIntoView({ block: 'start' }));
                }}
                mobileIconOnly
                icon="return"
                label="Add return"
              />
            )}
          </ActionBar>
        )}
      </div>
      {shortage() && <p class="notice">There is insufficient available stock to confirm this order.</p>}
      <Panel class="stack detail-summary">
        <h2>Order details</h2>
        <div class="component-scroll">
          <div class="form-grid">
            <div>
              <strong>Customer</strong>
              <p>{props.order.customer}</p>
            </div>
            {props.order.contact && (
              <div>
                <strong>Contact</strong>
                <p>{props.order.contact}</p>
              </div>
            )}
            {props.order.address && (
              <div>
                <strong>Delivery address</strong>
                <p>{props.order.address}</p>
              </div>
            )}
            {props.order.notes && (
              <div>
                <strong>Notes</strong>
                <p>{props.order.notes}</p>
              </div>
            )}
            <fieldset class="payment-status-tiles" disabled={props.busy}>
              <legend>Payment status</legend>
              <div class="row">
                {PAYMENT_STATUSES.map((status) => (
                  <label class="button secondary compact">
                    <Input
                      type="radio"
                      name={`payment-status-${props.order.id}`}
                      value={status}
                      checked={props.order.paymentStatus === status}
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const saved = await props.onCommit(
                          [{ tab: 'Orders', row: { ...props.order, paymentStatus: status } }],
                          [{ tab: 'Orders', row: props.order }],
                        );
                        if (!saved) {
                          for (const radio of input.closest('fieldset')?.querySelectorAll('input') ?? []) {
                            radio.checked = radio.value === props.order.paymentStatus;
                          }
                        }
                      }}
                    />
                    {status}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </Panel>
      <Panel class="stack detail-items">
        <h2>Order items</h2>
        <div class="component-scroll paged-viewport">
          <Table desktopOnly>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">SKU</th>
                <th scope="col">Quantity</th>
                <th scope="col">Unit price</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <PagedRows rows={items()} table estimate={56}>
              {(page) => (
                <For each={page()}>
                  {(item) => (
                    <tr>
                      <td>
                        <ProductLabel
                          name={item.productName}
                          image={products().get(variants().get(item.variantId)?.productId ?? '')?.image}
                        >
                          <strong>{item.productName}</strong>
                          <span class="inventory-row-meta muted">{item.variantName}</span>
                        </ProductLabel>
                      </td>
                      <td>{item.sku}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice, currency(), numberFormat())}</td>
                      <td>
                        {money(lineSubtotal(item.quantity, item.unitPrice), currency(), numberFormat())}
                      </td>
                    </tr>
                  )}
                </For>
              )}
            </PagedRows>
            <tbody>
              {!items().length && (
                <tr>
                  <td colspan={5}>This order has no items.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colspan={4}>
                  Subtotal
                </th>
                <td>{money(subtotal(), currency(), numberFormat())}</td>
              </tr>
              <tr>
                <th scope="row" colspan={4}>
                  Discount
                </th>
                <td>
                  {money(props.order.discount === 0 ? 0 : -props.order.discount, currency(), numberFormat())}
                </td>
              </tr>
              <tr>
                <th scope="row" colspan={4}>
                  {props.order.shippingOption || 'Shipping'}
                </th>
                <td>{money(props.order.shippingCharge, currency(), numberFormat())}</td>
              </tr>
              <tr>
                <th scope="row" colspan={4}>
                  Order total
                </th>
                <td>{money(orderTotal(subtotal(), props.order), currency(), numberFormat())}</td>
              </tr>
            </tfoot>
          </Table>
          <div class="mobile-records paged-viewport">
            <PagedRows rows={items()} estimate={100}>
              {(page) => (
                <For each={page()}>
                  {(item) => (
                    <article class="mobile-record">
                      <div class="mobile-record-head">
                        <ProductLabel
                          name={item.productName}
                          image={products().get(variants().get(item.variantId)?.productId ?? '')?.image}
                        >
                          <strong>{item.productName}</strong>
                          <span class="inventory-row-meta muted">
                            {item.variantName} · {item.sku}
                          </span>
                        </ProductLabel>
                        <strong>
                          {money(lineSubtotal(item.quantity, item.unitPrice), currency(), numberFormat())}
                        </strong>
                      </div>
                      <p class="muted">
                        {quantityLabel(item.quantity)} × {money(item.unitPrice, currency(), numberFormat())}
                      </p>
                    </article>
                  )}
                </For>
              )}
            </PagedRows>
            {!items().length && <p class="empty">This order has no items.</p>}
            <dl class="order-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(subtotal(), currency(), numberFormat())}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>
                  {money(props.order.discount === 0 ? 0 : -props.order.discount, currency(), numberFormat())}
                </dd>
              </div>
              <div>
                <dt>{props.order.shippingOption || 'Shipping'}</dt>
                <dd>{money(props.order.shippingCharge, currency(), numberFormat())}</dd>
              </div>
              <div>
                <dt>Order total</dt>
                <dd>
                  <strong>{money(orderTotal(subtotal(), props.order), currency(), numberFormat())}</strong>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Panel>
      {(canReturn() || returns().length > 0) && (
        <Panel class="stack detail-returns">
          <div class="row">
            <h2>Returns</h2>
          </div>
          <div class="component-scroll">
            {returning() && canReturn() && (
              <form
                class="stack"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError('');
                  const item = props.data['Order Items'].find(
                    (entry) => entry.orderId === props.order.id && entry.id === returnItemId(),
                  );
                  if (
                    !item ||
                    !Number.isSafeInteger(returnQuantity()) ||
                    returnQuantity() < 1 ||
                    returnQuantity() > countRemaining(item, props.data.Returns)
                  ) {
                    setError(
                      'Choose an order item and enter a quantity within its remaining return allowance.',
                    );
                    return;
                  }
                  const received = receiveNow();
                  const entry: ReturnEntry = {
                    id: makeId(),
                    orderItemId: item.id,
                    quantity: returnQuantity(),
                    status: received ? 'Received' : 'Requested',
                    condition: received ? returnCondition() : '',
                    receivedAt: received ? new Date().toISOString() : '',
                    notes: returnNotes().trim(),
                  };
                  if (await props.onCommit([{ tab: 'Returns', row: entry }])) setReturning(false);
                }}
              >
                <div class="form-grid">
                  <SelectField
                    label="Order item"
                    required
                    value={returnItemId()}
                    onChange={(value) => {
                      setReturnItemId(value);
                      setReturnQuantity(1);
                    }}
                    options={returnableItems().map((item) => ({
                      value: item.id,
                      image: products().get(variants().get(item.variantId)?.productId ?? '')?.image,
                      imageName: item.productName,
                      label: `${item.productName} · ${item.variantName} · ${item.sku} (${countRemaining(item, returns())} left)`,
                    }))}
                  />
                  <label class="field">
                    Return quantity
                    <Input
                      required
                      type="number"
                      min={1}
                      step={1}
                      max={remainingQuantity()}
                      value={returnQuantity() || ''}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setReturnQuantity(input.valueAsNumber);
                      }}
                    />
                  </label>
                  <SelectField
                    label="Return status"
                    value={receiveNow() ? 'Received' : 'Requested'}
                    onChange={(value) => {
                      setReceiveNow(value === 'Received');
                    }}
                    options={['Requested', 'Received'].map((value) => ({ value, label: value }))}
                  />
                  {receiveNow() && (
                    <SelectField
                      label="Condition"
                      value={returnCondition()}
                      onChange={(value) => {
                        setReturnCondition(value as ReturnCondition);
                      }}
                      options={RETURN_CONDITIONS.map((value) => ({ value, label: value }))}
                    />
                  )}
                  <label class="field">
                    Return notes
                    <Input
                      value={returnNotes()}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setReturnNotes(input.value);
                      }}
                    />
                  </label>
                </div>
                {error() && (
                  <p class="notice error" role="alert">
                    {error()}
                  </p>
                )}
                <ActionBar label="Return actions">
                  <Button
                    type="submit"
                    class="primary"
                    disabled={props.busy}
                    icon="save"
                    label="Save return"
                  />
                  <Button
                    type="button"
                    class="secondary"
                    disabled={props.busy}
                    onClick={() => {
                      setReturning(false);
                      setError('');
                    }}
                  >
                    Close
                  </Button>
                </ActionBar>
              </form>
            )}
            {returns().length > 0 ? (
              <>
                <Table desktopOnly class="paged-viewport">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Quantity</th>
                      <th scope="col">Status</th>
                      <th scope="col">Condition</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <PagedRows rows={returns()} table estimate={56}>
                    {(page) => (
                      <For each={page()}>
                        {(entry) => (
                          <tr>
                            <td>
                              <ProductLabel
                                name={itemById().get(entry.orderItemId)?.productName || 'Order item'}
                                image={
                                  products().get(
                                    variants().get(itemById().get(entry.orderItemId)?.variantId ?? '')
                                      ?.productId ?? '',
                                  )?.image
                                }
                              >
                                {itemById().get(entry.orderItemId)?.productName || 'Order item'}
                                <span class="inventory-row-meta muted">
                                  {itemById().get(entry.orderItemId)?.variantName} ·{' '}
                                  {itemById().get(entry.orderItemId)?.sku}
                                </span>
                              </ProductLabel>
                            </td>
                            <td>{entry.quantity}</td>
                            <td>
                              <Badge status={entry.status}>{entry.status}</Badge>
                            </td>
                            <td>
                              {entry.status === 'Requested' && canReturn() ? (
                                <ReceiveReturn entry={entry} busy={props.busy} onCommit={props.onCommit} />
                              ) : (
                                entry.condition || '—'
                              )}
                            </td>
                            <td>{entry.notes || '—'}</td>
                          </tr>
                        )}
                      </For>
                    )}
                  </PagedRows>
                </Table>
                <div class="mobile-records paged-viewport">
                  <PagedRows rows={returns()} estimate={100}>
                    {(page) => (
                      <For each={page()}>
                        {(entry) => (
                          <article class="mobile-record">
                            <div class="mobile-record-head">
                              <ProductLabel
                                name={itemById().get(entry.orderItemId)?.productName || 'Order item'}
                                image={
                                  products().get(
                                    variants().get(itemById().get(entry.orderItemId)?.variantId ?? '')
                                      ?.productId ?? '',
                                  )?.image
                                }
                              >
                                <strong>
                                  {itemById().get(entry.orderItemId)?.productName || 'Order item'}
                                </strong>
                                <span class="inventory-row-meta muted">
                                  {itemById().get(entry.orderItemId)?.variantName} ·{' '}
                                  {itemById().get(entry.orderItemId)?.sku}
                                </span>
                              </ProductLabel>
                              <Badge status={entry.status}>{entry.status}</Badge>
                            </div>
                            <p class="muted">
                              {quantityLabel(entry.quantity)}
                              {entry.condition ? ` · ${entry.condition}` : ''}
                            </p>
                            {entry.notes && <p>{entry.notes}</p>}
                            {entry.status === 'Requested' && canReturn() && (
                              <ReceiveReturn entry={entry} busy={props.busy} onCommit={props.onCommit} />
                            )}
                          </article>
                        )}
                      </For>
                    )}
                  </PagedRows>
                </div>
              </>
            ) : (
              !returning() && <p class="muted">No returns for this order.</p>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
