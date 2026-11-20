import { createMediaQuery } from '@solid-primitives/media';
import { createMemo, createSignal, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { orderPath } from '../../app/navigation/screen-route';
import { orderSubtotal, orderTotal } from '../../domain/order-totals';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import { ORDER_STATUSES, type Order } from '../../domain/workbook';
import { money } from '../../shared/lib/format';
import { SortableTable } from '../../shared/ui/sortable-table';
import { PagedRows } from '../../shared/ui/paged-rows';
import { ActionBar, Badge, Button, Input, MultiSelect, Panel } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ListFilters } from '../../shared/ui/list-filters';
import { dateLabel, indexOrderRows, returnLabel } from './order-helpers';
import type { OrdersProps } from './order-types';

const journeyStages = ORDER_STATUSES.filter((status) => status !== 'Cancelled');

export function OrderList(props: OrdersProps) {
  const { navigate } = useContext(ScreenNavigation);
  const mobile = createMediaQuery('(max-width: 760px)');
  const openOrder = (id: string) => navigate(orderPath(id));
  const [search, setSearch] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<string[]>([]);
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));
  const orderIndex = createMemo(() => indexOrderRows(props.data));
  const query = createMemo(() => search().trim().toLowerCase());
  const recentOrders = createMemo(() =>
    [...props.data.Orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const visible = createMemo(() => {
    const statuses = statusFilter();
    const term = query();
    if (!statuses.length && !term) return recentOrders();
    return recentOrders().filter(
      (order) =>
        (!statuses.length || statuses.includes(order.status)) &&
        (!term ||
          [order.number, order.customer, order.contact].some((field) => field.toLowerCase().includes(term))),
    );
  });
  const totalFor = (order: Order) =>
    orderTotal(orderSubtotal(orderIndex().itemsByOrder.get(order.id) ?? []), order);
  const summarize = (order: Order) => {
    const orderItems = orderIndex().itemsByOrder.get(order.id) ?? [];
    const returnStatus = returnLabel(orderItems, orderIndex().returnsByOrder.get(order.id) ?? []);
    const total = money(totalFor(order), currency(), numberFormat());
    return { total, returnStatus };
  };
  return (
    <div class="stack orders-page">
      <h1 class="sr-only">Orders</h1>
      <ActionBar class="record-shortcut" label="Orders actions">
        <Button
          type="button"
          class="primary"
          disabled={props.busy}
          onClick={() => navigate('/orders/new')}
          icon="order-add"
          label="New order"
        />
      </ActionBar>
      <section class="journey-board" aria-labelledby="order-journey-title">
        <div class="journey-header">
          <h2 id="order-journey-title">Order journey</h2>
        </div>
        <div class="journey-grid">
          {journeyStages.map((stage) => {
            const orders = recentOrders().filter((order) => order.status === stage);
            return (
              <section class="journey-stage" data-status={stage}>
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
                    aria-pressed={statusFilter().includes(stage) ? 'true' : 'false'}
                    onClick={() => {
                      setStatusFilter(
                        statusFilter().includes(stage)
                          ? statusFilter().filter((value) => value !== stage)
                          : [...statusFilter(), stage],
                      );
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
                        aria-label={`Open order ${order.number} for ${order.customer}`}
                        onClick={() => openOrder(order.id)}
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
          <ListFilters title="Filter orders" count={statusFilter().length + Number(Boolean(query()))}>
            <label class="field">
              Search orders
              <Input
                type="search"
                value={search()}
                placeholder="Order number or customer"
                onInput={(event) => {
                  const input = event.currentTarget;
                  setSearch(input.value);
                }}
              />
            </label>
            <MultiSelect
              placeholder="All statuses"
              label="Status"
              value={statusFilter()}
              options={ORDER_STATUSES.map((status) => ({ value: status, label: status }))}
              onChange={(value) => {
                setStatusFilter(value);
              }}
            />
          </ListFilters>
        </div>
        {visible().length > 0 ? (
          !mobile() ? (
            <SortableTable
              desktopOnly
              class="scroll-rows orders-table"
              aria-labelledby="order-list-title"
              rows={visible()}

              estimate={52}
              resetKey={JSON.stringify([query(), statusFilter()])}
              columns={[
                { label: 'Order', value: (r) => r.number },
                { label: 'Customer', value: (r) => r.customer },
                { label: 'Date', value: (r) => r.createdAt },
                { label: 'Status', value: (r) => r.status },
                { label: 'Payment', value: (r) => r.paymentStatus },
                { label: 'Total', value: (r) => totalFor(r) },
              ]}
            >
              {(page) => (
                <>
                  {page().map((order) => {
                    const { total, returnStatus } = summarize(order);
                    return (
                      <tr>
                        <td>
                          <Button type="button" class="secondary" onClick={() => openOrder(order.id)}>
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
                    );
                  })}
                </>
              )}
            </SortableTable>
          ) : (
            <div class="mobile-records paged-viewport">
              <PagedRows rows={visible()} estimate={110} resetKey={JSON.stringify([query(), statusFilter()])}>
                {(page) => (
                  <>
                    {page().map((order) => {
                      const { total, returnStatus } = summarize(order);
                      return (
                        <article class="mobile-record">
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
                            <Button
                              class="secondary open-order"
                              aria-label={`View order ${order.number}`}
                              onClick={() => openOrder(order.id)}
                              icon="arrow-right"
                              mobileIconOnly
                              label="View order"
                            />
                          </div>
                        </article>
                      );
                    })}
                  </>
                )}
              </PagedRows>
            </div>
          )
        ) : (
          <div class="empty">
            <p>
              {props.data.Orders.length
                ? 'No orders match these filters.'
                : 'No orders yet. Create a draft order to get started.'}
            </p>
            {(search() || statusFilter().length) && (
              <Button
                class="secondary"
                onClick={() => {
                  setSearch('');
                  setStatusFilter([]);
                }}
                icon="close"
                label="Clear filters"
              />
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
