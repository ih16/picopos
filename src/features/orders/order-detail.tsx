import { savedCharges, chargeLabel } from '../../domain/charges';
import { createMemo, createSignal, For } from 'solid-js';

import { lineSubtotal, orderSubtotal, orderTotal } from '../../domain/order-totals';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import type {
  Order,
  OrderStatus,
  PaymentStatus,
  ReturnCondition,
  Return as ReturnEntry,
} from '../../domain/workbook';
import {
  getInventory,
  isShipped,
  makeId,
  NEXT_STATUSES,
  PAYMENT_STATUSES,
  isPartialPayment,
  RETURN_CONDITIONS,
} from '../../domain/workbook';
import { money } from '../../shared/lib/format';
import { SortableTable } from '../../shared/ui/sortable-table';
import { PagedRows } from '../../shared/ui/paged-rows';
import { ActionBar, Badge, Button, Input, Panel, SelectField } from '../../shared/ui/controls';
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
  const [editingPayment, setEditingPayment] = createSignal<PaymentStatus>();
  const [amountInput, setAmountInput] = createSignal('');
  const paymentSelection = () => editingPayment() ?? props.order.paymentStatus;
  async function savePayment(status: PaymentStatus, partialAmount: number) {
    if (
      await props.onCommit(
        [{ tab: 'Orders', row: { ...props.order, paymentStatus: status, partialAmount } }],
        [{ tab: 'Orders', row: props.order }],
      )
    )
      setEditingPayment(undefined);
  }
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
  const charges = createMemo(() => savedCharges(props.order.charges));
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
      <div class="order-detail-layout">
        <Panel class="stack detail-summary">
          <h2>Customer and delivery</h2>
          <dl class="order-customer-fields">
            <div>
              <dt>Customer</dt>
              <dd>{props.order.customer}</dd>
            </div>
            {props.order.contact && (
              <div>
                <dt>Contact</dt>
                <dd>{props.order.contact}</dd>
              </div>
            )}
            {props.order.address && (
              <div>
                <dt>Delivery address</dt>
                <dd>{props.order.address}</dd>
              </div>
            )}
            {props.order.notes && (
              <div class="order-customer-notes">
                <dt>Notes</dt>
                <dd>{props.order.notes}</dd>
              </div>
            )}
          </dl>
        </Panel>
        <Panel class="stack detail-items">
          <h2>Order items</h2>
          <SortableTable
            desktopOnly
            paged
            rows={items()}
            estimate={56}
            columns={[
              { label: 'Item', value: (r) => [r.productName, r.variantName].join(' ') },
              { label: 'SKU', value: (r) => r.sku },
              { label: 'Quantity', value: (r) => r.quantity },
              { label: 'Unit price', value: (r) => r.unitPrice },
              { label: 'Total', value: (r) => lineSubtotal(r.quantity, r.unitPrice) },
            ]}
            emptyMessage="This order has no items."
          >
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
                    <td>{money(lineSubtotal(item.quantity, item.unitPrice), currency(), numberFormat())}</td>
                  </tr>
                )}
              </For>
            )}
          </SortableTable>
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
          </div>
        </Panel>
        <Panel class="stack detail-payment">
          <h2>Payment summary</h2>
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
            <For each={charges()}>
              {(charge) => (
                <div>
                  <dt>{chargeLabel(charge)}</dt>
                  <dd>{money(charge.amount, currency(), numberFormat())}</dd>
                </div>
              )}
            </For>
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
          <fieldset class="payment-status-tiles" disabled={props.busy}>
            <legend>Payment status</legend>
            <div class="row">
              {PAYMENT_STATUSES.map((status) => (
                <label class="button secondary compact">
                  <Input
                    type="radio"
                    name={`payment-status-${props.order.id}`}
                    value={status}
                    checked={paymentSelection() === status}
                    onChange={async (event) => {
                      const fieldset = event.currentTarget.closest('fieldset');
                      setEditingPayment(status);
                      setAmountInput('');
                      if (!isPartialPayment(status)) {
                        await savePayment(status, 0);
                        setEditingPayment(undefined);
                        for (const radio of fieldset?.querySelectorAll<HTMLInputElement>(
                          'input[type=radio]',
                        ) ?? [])
                          radio.checked = radio.value === props.order.paymentStatus;
                      } else if (status === props.order.paymentStatus) {
                        setAmountInput(String(props.order.partialAmount ?? ''));
                      }
                    }}
                  />
                  {status}
                </label>
              ))}
            </div>
            {isPartialPayment(paymentSelection()) && (
              <form
                class="stack partial-payment-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (editingPayment()) await savePayment(paymentSelection(), Number(amountInput()));
                }}
              >
                <label class="field">
                  {paymentSelection() === 'Partially paid' ? 'Amount paid' : 'Amount refunded'} ({currency()})
                  <Input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={editingPayment() ? amountInput() : (props.order.partialAmount ?? '')}
                    onInput={(event) => {
                      setAmountInput(event.currentTarget.value);
                      setEditingPayment(paymentSelection());
                    }}
                  />
                </label>
                {editingPayment() ? (
                  <div class="row">
                    <Button type="submit" class="primary" disabled={props.busy}>
                      Save payment
                    </Button>
                    <Button type="button" class="secondary" onClick={() => setEditingPayment(undefined)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p class="muted">
                    {props.order.paymentStatus === 'Partially paid' ? 'Balance due' : 'Payment retained'} ·{' '}
                    {money(
                      orderTotal(subtotal(), props.order) - (props.order.partialAmount ?? 0),
                      currency(),
                      numberFormat(),
                    )}
                  </p>
                )}
              </form>
            )}
          </fieldset>
        </Panel>
        {(canReturn() || returns().length > 0) && (
          <Panel class="stack detail-returns">
            <div class="row">
              <h2>Returns</h2>
            </div>
            <div class="stack detail-return-content">
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
                  <SortableTable
                    desktopOnly
                    paged
                    rows={returns()}
                    estimate={56}
                    columns={[
                      {
                        label: 'Item',
                        value: (r) => itemById().get(r.orderItemId)?.productName || 'Order item',
                      },
                      { label: 'Quantity', value: (r) => r.quantity },
                      { label: 'Status', value: (r) => r.status },
                      { label: 'Condition', value: (r) => r.condition || '' },
                      { label: 'Notes', value: (r) => r.notes || '' },
                    ]}
                  >
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
                  </SortableTable>
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
    </div>
  );
}
