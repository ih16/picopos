import { orderSubtotal, orderTotal } from '../../domain/order-totals';
import { decimalAmount } from '../../shared/lib/format';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import { component$, useComputed$, useContext, useSignal, type QRL } from '@builder.io/qwik';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { customerPath } from '../../app/navigation/screen-route';
import {
  customerDirectory,
  makeId,
  type Customer,
  type RowChange,
  type WorkbookData,
} from '../../domain/workbook';
import {
  ActionBar,
  Badge,
  Button,
  Input,
  Modal,
  MultiSelect,
  Panel,
  Table,
  Textarea,
} from '../../shared/ui/controls';
import { ReconnectNotice } from '../auth/connection';

type Props = {
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit$: QRL<(changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>>;
};
const blankCustomer = (): Customer => ({
  id: '',
  name: '',
  contact: '',
  address: '',
  notes: '',
  active: true,
});

const CustomerForm = component$<{
  customer: Customer;
  orders?: WorkbookData['Orders'];
  busy: boolean;
  error?: string;
  onCommit$: Props['onCommit$'];
  onSaved$: QRL<(id: string) => void | Promise<void>>;
  onCancel$?: QRL<() => void>;
}>(({ customer, orders = [], busy, error, onCommit$, onSaved$, onCancel$ }) => {
  const draft = useSignal<Customer>({ ...customer });
  const base = useSignal<Customer | undefined>(customer.id ? { ...customer } : undefined);
  const linkedOrders = useSignal<WorkbookData['Orders']>(
    customer.id ? [] : orders.map((order) => ({ ...order })),
  );
  const attempted = useSignal(false);
  return (
    <form
      class="stack"
      preventdefault:submit
      onSubmit$={async () => {
        attempted.value = true;
        const customer = {
          ...draft.value,
          id: draft.value.id || makeId(),
          name: draft.value.name.trim(),
          contact: draft.value.contact.trim(),
          address: draft.value.address.trim(),
          notes: draft.value.notes.trim(),
        };
        const changes: RowChange[] = [
          { tab: 'Customers', row: customer },
          ...linkedOrders.value.map((order): RowChange => ({
            tab: 'Orders',
            row: { ...order, customerId: customer.id },
          })),
        ];
        const before: RowChange[] = [
          ...(base.value ? [{ tab: 'Customers' as const, row: base.value }] : []),
          ...linkedOrders.value.map((order): RowChange => ({ tab: 'Orders', row: order })),
        ];
        if (await onCommit$(changes, before)) {
          draft.value = customer;
          base.value = { ...customer };
          linkedOrders.value = [];
          attempted.value = false;
          await onSaved$(customer.id);
        }
      }}
    >
      <div class="form-grid customer-fields">
        <label class="field">
          Customer name
          <Input
            required
            autocomplete="name"
            value={draft.value.name}
            onInput$={(_, el) => {
              draft.value = { ...draft.value, name: el.value };
            }}
          />
        </label>
        <label class="field">
          Phone or email
          <Input
            value={draft.value.contact}
            onInput$={(_, el) => {
              draft.value = { ...draft.value, contact: el.value };
            }}
          />
        </label>
        <label class="field customer-field-wide">
          Address
          <Textarea
            rows={2}
            autocomplete="street-address"
            value={draft.value.address}
            onInput$={(_, el) => {
              draft.value = { ...draft.value, address: el.value };
            }}
          />
        </label>
        <label class="field customer-field-wide">
          Notes
          <Textarea
            rows={2}
            value={draft.value.notes}
            onInput$={(_, el) => {
              draft.value = { ...draft.value, notes: el.value };
            }}
          />
        </label>
      </div>
      {linkedOrders.value.length > 0 && (
        <p class="muted">
          Links {linkedOrders.value.length} existing orders. Their original customer details stay unchanged.
        </p>
      )}
      {attempted.value && error && (
        <p class="notice error" role="alert">
          {error}
        </p>
      )}
      <ActionBar label="Customer editor actions">
        {onCancel$ && (
          <Button class="secondary" disabled={busy} onClick$={onCancel$}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : base.value ? 'Update customer' : 'Save customer'}
        </Button>
      </ActionBar>
    </form>
  );
});

export const Customers = component$<Props>(({ data, busy, error, onCommit$ }) => {
  const search = useSignal('');
  const statuses = useSignal<string[]>([]);
  const { route, navigate$ } = useContext(ScreenNavigation);
  const selectedKey = useComputed$(() => route.value.customerKey);
  const editorOpen = useSignal(false);
  const editorMounted = useSignal(false);
  const entries = customerDirectory(data);
  const selected = entries.find((entry) => entry.key === selectedKey.value);
  const query = search.value.trim().toLowerCase();
  const shown = entries.filter(
    ({ customer, saved }) =>
      (!statuses.value.length ||
        statuses.value.includes(!saved ? 'historical' : customer.active ? 'active' : 'archived')) &&
      (!query || `${customer.name} ${customer.contact} ${customer.address}`.toLowerCase().includes(query)),
  );
  const currency = workbookCurrency(data);
  const numberFormat = workbookNumberFormat(data);

  return (
    <section class={['stack customers-page', selected && 'customer-details-page']}>
      <h1 class="sr-only">Customers</h1>
      <Modal
        open={editorOpen}
        title="Add customer"
        onClosed$={() => {
          if (!editorOpen.value) editorMounted.value = false;
        }}
      >
        {editorMounted.value && <ReconnectNotice q:slot="notice" />}
        {editorMounted.value && (
          <CustomerForm
            customer={blankCustomer()}
            busy={busy}
            error={error}
            onCommit$={onCommit$}
            onCancel$={() => {
              editorOpen.value = false;
            }}
            onSaved$={async (id) => {
              editorOpen.value = false;
              await navigate$(customerPath(id));
            }}
          />
        )}
      </Modal>
      {selected ? (
        <>
          <header class="panel-heading customer-heading">
            <div class="row">
              <h2 class="page-title">{selected.customer.name}</h2>
            </div>
            <Badge status={selected.customer.active ? 'Active' : 'Archived'}>
              {!selected.saved ? 'From orders' : selected.customer.active ? 'Active' : 'Archived'}
            </Badge>
          </header>
          <Panel class="stack customer-profile">
            <h2>Contact details</h2>
            <div class="component-scroll">
              <CustomerForm
                key={selected.key}
                customer={selected.customer}
                orders={selected.orders}
                busy={busy}
                error={error}
                onCommit$={onCommit$}
                onSaved$={async (id) => {
                  if (selectedKey.value !== id) await navigate$(customerPath(id), true);
                }}
              />
            </div>
          </Panel>
          <Panel class="stack customer-history">
            <div class="panel-heading">
              <h2>Order history</h2>
              <span class="muted">{selected.orders.length} orders</span>
            </div>
            <div class="component-scroll">
              <Table class="scroll-rows customer-orders-table" aria-label="Order history">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th class="numeric">Total ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {[...selected.orders]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((order) => (
                      <tr key={order.id}>
                        <td>{order.number}</td>
                        <td>{order.createdAt.slice(0, 10)}</td>
                        <td>
                          <Badge status={order.status}>{order.status}</Badge>
                        </td>
                        <td>
                          <Badge status={order.paymentStatus}>{order.paymentStatus}</Badge>
                        </td>
                        <td class="numeric">
                          {decimalAmount(
                            orderTotal(
                              orderSubtotal(data['Order Items'].filter((item) => item.orderId === order.id)),
                              order,
                            ),
                            numberFormat,
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
              {!selected.orders.length && <p class="empty">No orders yet.</p>}
            </div>
          </Panel>
        </>
      ) : (
        <>
          <Panel class="stack customers-list">
            <div class="panel-heading">
              <div>
                <h2 class="page-title">Customers</h2>
                <p class="muted">
                  {shown.length} contacts · {data.Customers.length} saved
                </p>
              </div>
              <div class="row filters customer-filters">
                <label class="field">
                  Search customers
                  <Input
                    type="search"
                    placeholder="Name, phone, email or address"
                    value={search.value}
                    onInput$={(_, el) => {
                      search.value = el.value;
                    }}
                  />
                </label>
                <MultiSelect
                  label="Status"
                  placeholder="All customers"
                  value={statuses.value}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'archived', label: 'Archived' },
                    { value: 'historical', label: 'From orders' },
                  ]}
                  onChange$={(value) => {
                    statuses.value = value;
                  }}
                />
              </div>
            </div>
            <div class="component-scroll">
              <Table class="scroll-rows customers-table" aria-label="Customers">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone or email</th>
                    <th>Status</th>
                    <th class="numeric">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((entry) => (
                    <tr key={entry.key}>
                      <td>
                        <Button class="secondary" onClick$={() => navigate$(customerPath(entry.key))}>
                          {entry.customer.name}
                        </Button>
                      </td>
                      <td>{entry.customer.contact || '—'}</td>
                      <td>
                        <Badge status={entry.customer.active ? 'Active' : 'Archived'}>
                          {!entry.saved ? 'From orders' : entry.customer.active ? 'Active' : 'Archived'}
                        </Badge>
                      </td>
                      <td class="numeric">{entry.orders.length}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!shown.length && (
                <p class="empty">
                  {entries.length
                    ? 'No customers match these filters.'
                    : 'Add your first customer to get started.'}
                </p>
              )}
            </div>
          </Panel>
          {!editorMounted.value && (
            <ActionBar label="Customers actions">
              <Button
                disabled={busy}
                onClick$={() => {
                  editorMounted.value = true;
                  editorOpen.value = true;
                }}
              >
                Add customer
              </Button>
            </ActionBar>
          )}
        </>
      )}
    </section>
  );
});
