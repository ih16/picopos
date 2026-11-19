import { lineSubtotal, orderSubtotal, orderTotal } from '../../domain/order-totals';
import { money } from '../../shared/lib/format';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import { $, component$, useContext, useSignal, useTask$ } from '@builder.io/qwik';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { orderPath } from '../../app/navigation/screen-route';
import {
  getInventory,
  isShipped,
  makeId,
  NEXT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  RETURN_CONDITIONS,
} from '../../domain/workbook';
import {
  ActionBar,
  Badge,
  Button,
  Input,
  MultiSelect,
  Panel,
  SelectField,
  Table,
} from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductLabel } from '../../shared/ui/product-thumbnail';
import { CreateOrder } from './create-order';
import { ReceiveReturn } from './receive-return';

import { countRemaining, dateLabel, quantityLabel, returnLabel } from './order-helpers';
import type { OrdersProps } from './order-types';
import type { OrderItem, OrderStatus, ReturnCondition, Return as ReturnEntry } from '../../domain/workbook';
const statusLabels: Record<OrderStatus, string> = {
  Draft: 'Draft',
  'In progress': 'Confirm order',
  Shipped: 'Mark shipped',
  Completed: 'Mark completed',
  Cancelled: 'Cancel order',
};

const journeyStages = ORDER_STATUSES.filter((status) => status !== 'Cancelled');

export const Orders = component$<OrdersProps>(({ data, busy, onCommit$, saveError }) => {
  const { route, navigate$ } = useContext(ScreenNavigation);
  const selectedId = useSignal('');
  const creating = useSignal(false);
  const search = useSignal('');
  const statusFilter = useSignal<string[]>([]);
  const error = useSignal('');
  const returning = useSignal(false);
  const returnItemId = useSignal('');
  const returnQuantity = useSignal(1);
  const returnCondition = useSignal<ReturnCondition>('Sellable');
  const returnNotes = useSignal('');
  const receiveNow = useSignal(false);
  const openOrder = $(async (id: string) => {
    await navigate$(orderPath(id));
    returning.value = false;
    error.value = '';
  });

  useTask$(({ track }) => {
    const screen = track(() => route.value);
    if (screen.page !== 'Orders') return;
    selectedId.value = screen.orderId;
    creating.value = screen.creating;
    returning.value = false;
    error.value = '';
  });

  const currency = workbookCurrency(data);
  const numberFormat = workbookNumberFormat(data);
  const products = new Map(data.Products.map((product) => [product.id, product]));
  const variants = new Map(data.Variants.map((variant) => [variant.id, variant]));
  const itemsByOrder = new Map<string, OrderItem[]>();
  const orderByItemId = new Map<string, string>();
  for (const item of data['Order Items']) {
    orderByItemId.set(item.id, item.orderId);
    const previous = itemsByOrder.get(item.orderId) ?? [];
    previous.push(item);
    itemsByOrder.set(item.orderId, previous);
  }
  const returnsByOrder = new Map<string, ReturnEntry[]>();
  for (const entry of data.Returns) {
    const orderId = orderByItemId.get(entry.orderItemId);
    if (!orderId) continue;
    const previous = returnsByOrder.get(orderId) ?? [];
    previous.push(entry);
    returnsByOrder.set(orderId, previous);
  }
  const selected = data.Orders.find((order) => order.id === selectedId.value);
  const items = selected ? (itemsByOrder.get(selected.id) ?? []) : [];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const returns = selected ? (returnsByOrder.get(selected.id) ?? []) : [];
  const returnableItems = items.filter((item) => countRemaining(item, returns) > 0);
  const chosenReturnItem = returnableItems.find((item) => item.id === returnItemId.value);
  const canReturn = Boolean(selected && isShipped(selected.status));

  if (creating.value)
    return <CreateOrder data={data} busy={busy} onCommit$={onCommit$} saveError={saveError} />;

  if (selectedId.value && !selected) {
    return (
      <div class="stack record-page">
        <div class="order-header">
          <h1>Order not found</h1>
        </div>
        <Panel>
          <p>This order is not available in the connected workbook.</p>
        </Panel>
      </div>
    );
  }

  if (selected) {
    const returnStatus = returnLabel(items, returns);
    const subtotal = orderSubtotal(items);
    const shortage =
      selected.status === 'Draft' &&
      (() => {
        const balances = new Map(getInventory(data).map((entry) => [entry.variantId, entry]));
        const totals = new Map<string, number>();
        for (const item of items)
          totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity);
        return [...totals].some(([id, quantity]) => quantity > (balances.get(id)?.available ?? 0));
      })();

    return (
      <div class="stack record-page order-detail-page">
        <div class="order-header">
          <div class="order-header-details">
            <h1>{selected.number}</h1>
            <div class="row order-header-meta">
              <p class="muted">Created {dateLabel(selected.createdAt)}</p>
              <Badge status={selected.status}>{selected.status}</Badge>
              {returnStatus && <Badge status={returnStatus}>{returnStatus}</Badge>}
            </div>
          </div>
          {!returning.value && (
            <ActionBar label="Order actions">
              {NEXT_STATUSES[selected.status].map((status) => (
                <Button
                  type="button"
                  key={status}
                  class={status === 'Cancelled' ? 'secondary danger' : 'primary'}
                  disabled={
                    busy ||
                    (status === 'In progress' && (!items.length || shortage)) ||
                    (status === 'Shipped' && !items.length)
                  }
                  onClick$={async () => {
                    await onCommit$(
                      [{ tab: 'Orders', row: { ...selected, status } }],
                      [{ tab: 'Orders', row: selected }],
                    );
                  }}
                >
                  {statusLabels[status]}
                </Button>
              ))}
              {canReturn && returnableItems.length > 0 && !returning.value && (
                <Button
                  type="button"
                  class="secondary"
                  disabled={busy}
                  onClick$={() => {
                    returnItemId.value = '';
                    returnQuantity.value = 1;
                    returnCondition.value = 'Sellable';
                    returnNotes.value = '';
                    receiveNow.value = false;
                    error.value = '';
                    returning.value = true;
                  }}
                >
                  Add return
                </Button>
              )}
            </ActionBar>
          )}
        </div>
        {shortage && <p class="notice">There is insufficient available stock to confirm this order.</p>}
        <Panel class="stack detail-summary">
          <h2>Order details</h2>
          <div class="component-scroll">
            <div class="form-grid">
              <div>
                <strong>Customer</strong>
                <p>{selected.customer}</p>
              </div>
              {selected.contact && (
                <div>
                  <strong>Contact</strong>
                  <p>{selected.contact}</p>
                </div>
              )}
              {selected.address && (
                <div>
                  <strong>Delivery address</strong>
                  <p>{selected.address}</p>
                </div>
              )}
              {selected.notes && (
                <div>
                  <strong>Notes</strong>
                  <p>{selected.notes}</p>
                </div>
              )}
              <fieldset class="payment-status-tiles" disabled={busy}>
                <legend>Payment status</legend>
                <div class="row">
                  {PAYMENT_STATUSES.map((status) => (
                    <label key={status} class="button secondary compact">
                      <Input
                        type="radio"
                        name={`payment-status-${selected.id}`}
                        value={status}
                        checked={selected.paymentStatus === status}
                        onChange$={async (_, input) => {
                          const saved = await onCommit$(
                            [{ tab: 'Orders', row: { ...selected, paymentStatus: status } }],
                            [{ tab: 'Orders', row: selected }],
                          );
                          if (!saved) {
                            for (const radio of input.closest('fieldset')?.querySelectorAll('input') ?? []) {
                              radio.checked = radio.value === selected.paymentStatus;
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
          <div class="component-scroll">
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
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <ProductLabel
                        name={item.productName}
                        image={products.get(variants.get(item.variantId)?.productId ?? '')?.image}
                      >
                        <strong>{item.productName}</strong>
                        <span class="inventory-row-meta muted">{item.variantName}</span>
                      </ProductLabel>
                    </td>
                    <td>{item.sku}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitPrice, currency, numberFormat)}</td>
                    <td>{money(lineSubtotal(item.quantity, item.unitPrice), currency, numberFormat)}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={5}>This order has no items.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={4}>
                    Subtotal
                  </th>
                  <td>{money(subtotal, currency, numberFormat)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={4}>
                    Discount
                  </th>
                  <td>{money(selected.discount === 0 ? 0 : -selected.discount, currency, numberFormat)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={4}>
                    {selected.shippingOption || 'Shipping'}
                  </th>
                  <td>{money(selected.shippingCharge, currency, numberFormat)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={4}>
                    Order total
                  </th>
                  <td>{money(orderTotal(subtotal, selected), currency, numberFormat)}</td>
                </tr>
              </tfoot>
            </Table>
            <div class="mobile-records">
              {items.map((item) => (
                <article class="mobile-record" key={item.id}>
                  <div class="mobile-record-head">
                    <ProductLabel
                      name={item.productName}
                      image={products.get(variants.get(item.variantId)?.productId ?? '')?.image}
                    >
                      <strong>{item.productName}</strong>
                      <span class="inventory-row-meta muted">
                        {item.variantName} · {item.sku}
                      </span>
                    </ProductLabel>
                    <strong>
                      {money(lineSubtotal(item.quantity, item.unitPrice), currency, numberFormat)}
                    </strong>
                  </div>
                  <p class="muted">
                    {quantityLabel(item.quantity)} × {money(item.unitPrice, currency, numberFormat)}
                  </p>
                </article>
              ))}
              {!items.length && <p class="empty">This order has no items.</p>}
              <dl class="order-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(subtotal, currency, numberFormat)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>{money(selected.discount === 0 ? 0 : -selected.discount, currency, numberFormat)}</dd>
                </div>
                <div>
                  <dt>{selected.shippingOption || 'Shipping'}</dt>
                  <dd>{money(selected.shippingCharge, currency, numberFormat)}</dd>
                </div>
                <div>
                  <dt>Order total</dt>
                  <dd>
                    <strong>{money(orderTotal(subtotal, selected), currency, numberFormat)}</strong>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Panel>
        {(canReturn || returns.length > 0) && (
          <Panel class="stack detail-returns">
            <div class="row">
              <h2>Returns</h2>
            </div>
            <div class="component-scroll">
              {returning.value && canReturn && (
                <form
                  class="stack"
                  preventdefault:submit
                  onSubmit$={async () => {
                    error.value = '';
                    const item = data['Order Items'].find(
                      (entry) => entry.orderId === selected.id && entry.id === returnItemId.value,
                    );
                    if (
                      !item ||
                      !Number.isSafeInteger(returnQuantity.value) ||
                      returnQuantity.value < 1 ||
                      returnQuantity.value > countRemaining(item, data.Returns)
                    ) {
                      error.value =
                        'Choose an order item and enter a quantity within its remaining return allowance.';
                      return;
                    }
                    const received = receiveNow.value;
                    const entry: ReturnEntry = {
                      id: makeId(),
                      orderItemId: item.id,
                      quantity: returnQuantity.value,
                      status: received ? 'Received' : 'Requested',
                      condition: received ? returnCondition.value : '',
                      receivedAt: received ? new Date().toISOString() : '',
                      notes: returnNotes.value.trim(),
                    };
                    if (await onCommit$([{ tab: 'Returns', row: entry }])) returning.value = false;
                  }}
                >
                  <div class="form-grid">
                    <SelectField
                      label="Order item"
                      required
                      value={returnItemId.value}
                      onChange$={(value) => {
                        returnItemId.value = value;
                        returnQuantity.value = 1;
                      }}
                      options={returnableItems.map((item) => ({
                        value: item.id,
                        image: products.get(variants.get(item.variantId)?.productId ?? '')?.image,
                        imageName: item.productName,
                        label: `${item.productName} · ${item.variantName} · ${item.sku} (${countRemaining(item, returns)} left)`,
                      }))}
                    />
                    <label class="field">
                      Return quantity
                      <Input
                        required
                        type="number"
                        min={1}
                        step={1}
                        max={chosenReturnItem ? countRemaining(chosenReturnItem, returns) : undefined}
                        value={returnQuantity.value || ''}
                        onInput$={(_, input) => {
                          returnQuantity.value = input.valueAsNumber;
                        }}
                      />
                    </label>
                    <SelectField
                      label="Return status"
                      value={receiveNow.value ? 'Received' : 'Requested'}
                      onChange$={(value) => {
                        receiveNow.value = value === 'Received';
                      }}
                      options={['Requested', 'Received'].map((value) => ({ value, label: value }))}
                    />
                    {receiveNow.value && (
                      <SelectField
                        label="Condition"
                        value={returnCondition.value}
                        onChange$={(value) => {
                          returnCondition.value = value as ReturnCondition;
                        }}
                        options={RETURN_CONDITIONS.map((value) => ({ value, label: value }))}
                      />
                    )}
                    <label class="field">
                      Return notes
                      <Input
                        value={returnNotes.value}
                        onInput$={(_, input) => {
                          returnNotes.value = input.value;
                        }}
                      />
                    </label>
                  </div>
                  {error.value && (
                    <p class="notice error" role="alert">
                      {error.value}
                    </p>
                  )}
                  <ActionBar label="Return actions">
                    <Button type="submit" class="primary" disabled={busy}>
                      Save return
                    </Button>
                    <Button
                      type="button"
                      class="secondary"
                      disabled={busy}
                      onClick$={() => {
                        returning.value = false;
                        error.value = '';
                      }}
                    >
                      Close
                    </Button>
                  </ActionBar>
                </form>
              )}
              {returns.length > 0 ? (
                <>
                  <Table desktopOnly>
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Status</th>
                        <th scope="col">Condition</th>
                        <th scope="col">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <ProductLabel
                              name={itemById.get(entry.orderItemId)?.productName || 'Order item'}
                              image={
                                products.get(
                                  variants.get(itemById.get(entry.orderItemId)?.variantId ?? '')?.productId ??
                                    '',
                                )?.image
                              }
                            >
                              {itemById.get(entry.orderItemId)?.productName || 'Order item'}
                              <span class="inventory-row-meta muted">
                                {itemById.get(entry.orderItemId)?.variantName} ·{' '}
                                {itemById.get(entry.orderItemId)?.sku}
                              </span>
                            </ProductLabel>
                          </td>
                          <td>{entry.quantity}</td>
                          <td>
                            <Badge status={entry.status}>{entry.status}</Badge>
                          </td>
                          <td>
                            {entry.status === 'Requested' && canReturn ? (
                              <ReceiveReturn entry={entry} busy={busy} onCommit$={onCommit$} />
                            ) : (
                              entry.condition || '—'
                            )}
                          </td>
                          <td>{entry.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <div class="mobile-records">
                    {returns.map((entry) => (
                      <article class="mobile-record" key={entry.id}>
                        <div class="mobile-record-head">
                          <ProductLabel
                            name={itemById.get(entry.orderItemId)?.productName || 'Order item'}
                            image={
                              products.get(
                                variants.get(itemById.get(entry.orderItemId)?.variantId ?? '')?.productId ??
                                  '',
                              )?.image
                            }
                          >
                            <strong>{itemById.get(entry.orderItemId)?.productName || 'Order item'}</strong>
                            <span class="inventory-row-meta muted">
                              {itemById.get(entry.orderItemId)?.variantName} ·{' '}
                              {itemById.get(entry.orderItemId)?.sku}
                            </span>
                          </ProductLabel>
                          <Badge status={entry.status}>{entry.status}</Badge>
                        </div>
                        <p class="muted">
                          {quantityLabel(entry.quantity)}
                          {entry.condition ? ` · ${entry.condition}` : ''}
                        </p>
                        {entry.notes && <p>{entry.notes}</p>}
                        {entry.status === 'Requested' && canReturn && (
                          <ReceiveReturn entry={entry} busy={busy} onCommit$={onCommit$} />
                        )}
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                !returning.value && <p class="muted">No returns for this order.</p>
              )}
            </div>
          </Panel>
        )}
      </div>
    );
  }

  const query = search.value.trim().toLowerCase();
  const recentOrders = [...data.Orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = recentOrders
    .filter((order) => !statusFilter.value.length || statusFilter.value.includes(order.status))
    .filter(
      (order) =>
        !query ||
        [order.number, order.customer, order.contact].some((field) => field.toLowerCase().includes(query)),
    )
    .map((order) => {
      const orderItems = itemsByOrder.get(order.id) ?? [];
      return {
        order,
        returnStatus: returnLabel(orderItems, returnsByOrder.get(order.id) ?? []),
        total: money(orderTotal(orderSubtotal(orderItems), order), currency, numberFormat),
      };
    });

  return (
    <div class="stack orders-page">
      <h1 class="sr-only">Orders</h1>
      <ActionBar label="Orders actions">
        <Button type="button" class="primary" disabled={busy} onClick$={() => navigate$('/orders/new')}>
          <Icon name="plus" /> New order
        </Button>
      </ActionBar>
      <section class="journey-board" aria-labelledby="order-journey-title">
        <div class="journey-header">
          <h2 id="order-journey-title">Order journey</h2>
        </div>
        <div class="journey-grid">
          {journeyStages.map((stage) => {
            const orders = recentOrders.filter((order) => order.status === stage);
            return (
              <section class="journey-stage" data-status={stage} key={stage}>
                <div class="journey-stage-top">
                  <h3>
                    <span class="journey-dot" aria-hidden="true" />
                    {stage}
                  </h3>
                  <Button
                    type="button"
                    unstyled
                    class="journey-count"
                    aria-label={`Filter list by ${stage}`}
                    aria-controls="order-list"
                    aria-pressed={statusFilter.value.includes(stage)}
                    onClick$={() => {
                      statusFilter.value = statusFilter.value.includes(stage)
                        ? statusFilter.value.filter((value) => value !== stage)
                        : [...statusFilter.value, stage];
                    }}
                  >
                    {orders.length}
                  </Button>
                </div>
                {orders.length ? (
                  <div class="journey-orders">
                    {orders.slice(0, 2).map((order) => (
                      <Button
                        type="button"
                        unstyled
                        class="journey-order"
                        key={order.id}
                        aria-label={`Open order ${order.number} for ${order.customer}`}
                        onClick$={() => openOrder(order.id)}
                      >
                        <span class="journey-order-text">
                          <strong>{order.number}</strong>
                          <small>{order.customer}</small>
                        </span>
                        <span class="journey-arrow">
                          <Icon name="arrow-right" />
                        </span>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p class="journey-empty">No orders</p>
                )}
              </section>
            );
          })}
        </div>
      </section>
      <Panel class="stack orders-list" id="order-list" role="region" aria-labelledby="order-list-title">
        <div class="orders-list-header">
          <h2 id="order-list-title">Order list</h2>
          <div class="row filters">
            <label class="field">
              Search orders
              <Input
                type="search"
                value={search.value}
                placeholder="Order number or customer"
                onInput$={(_, input) => {
                  search.value = input.value;
                }}
              />
            </label>
            <MultiSelect
              placeholder="All statuses"
              label="Status"
              value={statusFilter.value}
              options={ORDER_STATUSES.map((status) => ({ value: status, label: status }))}
              onChange$={(value) => {
                statusFilter.value = value;
              }}
            />
          </div>
        </div>
        {visible.length > 0 ? (
          <>
            <Table desktopOnly class="scroll-rows orders-table" aria-labelledby="order-list-title">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ order, returnStatus, total }) => (
                  <tr key={order.id}>
                    <td>
                      <Button type="button" class="secondary" onClick$={() => openOrder(order.id)}>
                        {order.number}
                      </Button>
                    </td>
                    <td>{order.customer}</td>
                    <td>{dateLabel(order.createdAt)}</td>
                    <td>
                      <div class="row">
                        <Badge status={order.status}>{order.status}</Badge>
                        {returnStatus && <Badge status={returnStatus}>{returnStatus}</Badge>}
                      </div>
                    </td>
                    <td>
                      <Badge status={order.paymentStatus}>{order.paymentStatus}</Badge>
                    </td>
                    <td>{total}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div class="mobile-records">
              {visible.map(({ order, returnStatus, total }) => (
                <article class="mobile-record" key={order.id}>
                  <div class="mobile-record-head">
                    <div>
                      <strong>{order.customer}</strong>
                      <p class="muted">
                        {order.number} · {dateLabel(order.createdAt)}
                      </p>
                    </div>
                    <strong>{total}</strong>
                  </div>
                  <div class="row">
                    <Badge status={order.status}>{order.status}</Badge>
                    <Badge status={order.paymentStatus}>{order.paymentStatus}</Badge>
                    {returnStatus && <Badge status={returnStatus}>{returnStatus}</Badge>}
                  </div>
                  <div class="row">
                    <Button
                      class="secondary"
                      aria-label={`View order ${order.number}`}
                      onClick$={() => openOrder(order.id)}
                    >
                      View order <Icon name="arrow-right" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div class="empty">
            <p>
              {data.Orders.length
                ? 'No orders match these filters.'
                : 'No orders yet. Create a draft order to get started.'}
            </p>
            {(search.value || statusFilter.value.length) && (
              <Button
                class="secondary"
                onClick$={() => {
                  search.value = '';
                  statusFilter.value = [];
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
});
