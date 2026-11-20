import { createMemo, createSignal, For, Show, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { customerPath } from '../../app/navigation/screen-route';
import { orderSubtotal, orderTotal } from '../../domain/order-totals';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import {
  customerDirectory,
  makeId,
  type Customer,
  type RowChange,
  type WorkbookData,
} from '../../domain/workbook';
import { decimalAmount } from '../../shared/lib/format';
import {
  ActionBar,
  Badge,
  Button,
  EditorForm,
  Input,
  Modal,
  MultiSelect,
  Panel,
  Textarea,
} from '../../shared/ui/controls';
import { SortableTable } from '../../shared/ui/sortable-table';
import { ListFilters } from '../../shared/ui/list-filters';
import { ReconnectNotice } from '../auth/connection';

type CustomersProps = {
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit: (changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>;
};
const blankCustomer = (): Customer => ({
  id: '',
  name: '',
  contact: '',
  address: '',
  notes: '',
  active: true,
});

type CustomerFormProps = {
  customer: Customer;
  orders?: WorkbookData['Orders'];
  busy: boolean;
  error?: string;
  onCommit: CustomersProps['onCommit'];
  onSaved: (id: string) => void | Promise<void>;
  onCancel?: () => void;
};

function CustomerForm(props: CustomerFormProps) {
  const [draft, setDraft] = createSignal<Customer>({ ...props.customer });
  const [base, setBase] = createSignal<Customer | undefined>(
    props.customer.id ? { ...props.customer } : undefined,
  );
  const [linkedOrders, setLinkedOrders] = createSignal<WorkbookData['Orders']>(
    props.customer.id ? [] : (props.orders ?? []).map((order) => ({ ...order })),
  );
  const [attempted, setAttempted] = createSignal(false);
  return (
    <EditorForm
      class="stack"
      onSubmit={async () => {
        setAttempted(true);
        const customer = {
          ...draft(),
          id: draft().id || makeId(),
          name: draft().name.trim(),
          contact: draft().contact.trim(),
          address: draft().address.trim(),
          notes: draft().notes.trim(),
        };
        const changes: RowChange[] = [
          { tab: 'Customers', row: customer },
          ...linkedOrders().map((order): RowChange => ({
            tab: 'Orders',
            row: { ...order, customerId: customer.id },
          })),
        ];
        const previous = base();
        const before: RowChange[] = [
          ...(previous ? [{ tab: 'Customers' as const, row: previous }] : []),
          ...linkedOrders().map((order): RowChange => ({ tab: 'Orders', row: order })),
        ];
        if (await props.onCommit(changes, before)) {
          setDraft(customer);
          setBase({ ...customer });
          setLinkedOrders([]);
          setAttempted(false);
          await props.onSaved(customer.id);
        }
      }}
      actions={
        <ActionBar class={props.onCancel ? undefined : 'record-shortcut'} label="Customer editor actions">
          {props.onCancel && (
            <Button
              class="secondary"
              disabled={props.busy}
              onClick={props.onCancel}
              icon="close"
              label="Cancel"
            />
          )}
          <Button
            type="submit"
            disabled={props.busy}
            icon={props.onCancel ? 'save' : 'customer-edit'}
            label={props.busy ? 'Saving…' : base() ? 'Update customer' : 'Save customer'}
          />
        </ActionBar>
      }
    >
      <div class="form-grid customer-fields">
        <label class="field">
          Customer name
          <Input
            required
            autocomplete="name"
            value={draft().name}
            onInput={(event) => {
              const el = event.currentTarget;
              setDraft({ ...draft(), name: el.value });
            }}
          />
        </label>
        <label class="field">
          Phone or email
          <Input
            value={draft().contact}
            onInput={(event) => {
              const el = event.currentTarget;
              setDraft({ ...draft(), contact: el.value });
            }}
          />
        </label>
        <label class="field customer-field-wide">
          Address
          <Textarea
            rows={2}
            autocomplete="street-address"
            value={draft().address}
            onInput={(event) => {
              const el = event.currentTarget;
              setDraft({ ...draft(), address: el.value });
            }}
          />
        </label>
        <label class="field customer-field-wide">
          Notes
          <Textarea
            rows={2}
            value={draft().notes}
            onInput={(event) => {
              const el = event.currentTarget;
              setDraft({ ...draft(), notes: el.value });
            }}
          />
        </label>
      </div>
      {linkedOrders().length > 0 && (
        <p class="muted">
          Links {linkedOrders().length} existing orders. Their original customer details stay unchanged.
        </p>
      )}
      {attempted() && props.error && (
        <p class="notice error" role="alert">
          {props.error}
        </p>
      )}
    </EditorForm>
  );
}

export function Customers(props: CustomersProps) {
  const customerOrderTotal = (order: CustomersProps['data']['Orders'][number]) =>
    orderTotal(orderSubtotal(props.data['Order Items'].filter((item) => item.orderId === order.id)), order);
  const [search, setSearch] = createSignal('');
  const [statuses, setStatuses] = createSignal<string[]>([]);
  const { route, navigate } = useContext(ScreenNavigation);
  const selectedKey = createMemo(() => route().customerKey);
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editorMounted, setEditorMounted] = createSignal(false);
  const entries = createMemo(() => customerDirectory(props.data));
  const selected = createMemo(() => entries().find((entry) => entry.key === selectedKey()));
  const query = createMemo(() => search().trim().toLowerCase());
  const shown = createMemo(() =>
    entries().filter(
      ({ customer, saved }) =>
        (!statuses().length ||
          statuses().includes(!saved ? 'historical' : customer.active ? 'active' : 'archived')) &&
        (!query() ||
          `${customer.name} ${customer.contact} ${customer.address}`.toLowerCase().includes(query())),
    ),
  );
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));

  return (
    <section class={['stack customers-page', selected() && 'customer-details-page']}>
      <h1 class="sr-only">Customers</h1>
      <Modal
        open={editorOpen()}
        onDismiss={() => setEditorOpen(false)}
        title="Add customer"
        onClosed={() => {
          if (!editorOpen()) setEditorMounted(false);
        }}
        notice={editorMounted() && <ReconnectNotice />}
      >
        {editorMounted() && (
          <CustomerForm
            customer={blankCustomer()}
            busy={props.busy}
            error={props.error}
            onCommit={props.onCommit}
            onCancel={() => {
              setEditorOpen(false);
            }}
            onSaved={async (id) => {
              setEditorOpen(false);
              await navigate(customerPath(id));
            }}
          />
        )}
      </Modal>
      <Show
        when={selected()}
        fallback={
          <>
            <Panel class="stack customers-list">
              <div class="panel-heading">
                <div>
                  <h2 class="page-title">Customers</h2>
                  <p class="muted">
                    {shown().length} contacts · {props.data.Customers.length} saved
                  </p>
                </div>
                <ListFilters
                  title="Filter customers"
                  count={statuses().length + Number(Boolean(query()))}
                  class="customer-filters"
                >
                  <label class="field">
                    Search customers
                    <Input
                      type="search"
                      placeholder="Name, phone, email or address"
                      value={search()}
                      onInput={(event) => {
                        const el = event.currentTarget;
                        setSearch(el.value);
                      }}
                    />
                  </label>
                  <MultiSelect
                    label="Status"
                    placeholder="All customers"
                    value={statuses()}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'archived', label: 'Archived' },
                      { value: 'historical', label: 'From orders' },
                    ]}
                    onChange={(value) => {
                      setStatuses(value);
                    }}
                  />
                </ListFilters>
              </div>
              <div class="component-scroll">
                <SortableTable
                  class="scroll-rows paged-viewport customers-table"
                  aria-label="Customers"
                  rows={shown()}
                  estimate={55}
                  resetKey={JSON.stringify([query(), statuses()])}
                  columns={[
                    { label: 'Customer', value: (r) => r.customer.name },
                    { label: 'Phone or email', value: (r) => r.customer.contact },
                    {
                      label: 'Status',
                      value: (r) => (!r.saved ? 'From orders' : r.customer.active ? 'Active' : 'Archived'),
                    },
                    { label: 'Orders', value: (r) => r.orders.length, class: 'numeric' },
                  ]}
                >
                  {(page) => (
                    <>
                      <For each={page()}>
                        {(entry) => (
                          <tr>
                            <td>
                              <Button class="secondary" onClick={() => navigate(customerPath(entry.key))}>
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
                        )}
                      </For>
                    </>
                  )}
                </SortableTable>
                {!shown().length && (
                  <p class="empty">
                    {entries().length
                      ? 'No customers match these filters.'
                      : 'Add your first customer to get started.'}
                  </p>
                )}
              </div>
            </Panel>
            {!editorMounted() && (
              <ActionBar class="record-shortcut" label="Customers actions">
                <Button
                  disabled={props.busy}
                  onClick={() => {
                    setEditorMounted(true);
                    setEditorOpen(true);
                  }}
                  icon="customer-add"
                  label="Add customer"
                />
              </ActionBar>
            )}
          </>
        }
      >
        {(entry) => (
          <>
            <header class="panel-heading customer-heading">
              <div class="row">
                <h2 class="page-title">{entry().customer.name}</h2>
              </div>
              <Badge status={entry().customer.active ? 'Active' : 'Archived'}>
                {!entry().saved ? 'From orders' : entry().customer.active ? 'Active' : 'Archived'}
              </Badge>
            </header>
            <Panel class="stack customer-profile">
              <h2>Contact details</h2>
              <div class="component-scroll">
                <CustomerForm
                  customer={entry().customer}
                  orders={entry().orders}
                  busy={props.busy}
                  error={props.error}
                  onCommit={props.onCommit}
                  onSaved={async (id) => {
                    if (selectedKey() !== id) await navigate(customerPath(id), true);
                  }}
                />
              </div>
            </Panel>
            <Panel class="stack customer-history">
              <div class="panel-heading">
                <h2>Order history</h2>
                <span class="muted">{entry().orders.length} orders</span>
              </div>
              <div class="component-scroll">
                <SortableTable
                  class="scroll-rows paged-viewport customer-orders-table"
                  aria-label="Order history"
                  rows={[...entry().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
                  estimate={55}
                  columns={[
                    { label: 'Order', value: (r) => r.number },
                    { label: 'Date', value: (r) => r.createdAt },
                    { label: 'Status', value: (r) => r.status },
                    { label: 'Payment', value: (r) => r.paymentStatus },
                    { label: `Total (${currency()})`, value: (r) => customerOrderTotal(r), class: 'numeric' },
                  ]}
                >
                  {(page) => (
                    <>
                      {page().map((order) => (
                        <tr>
                          <td>{order.number}</td>
                          <td>{order.createdAt.slice(0, 10)}</td>
                          <td>
                            <Badge status={order.status}>{order.status}</Badge>
                          </td>
                          <td>
                            <Badge status={order.paymentStatus}>{order.paymentStatus}</Badge>
                          </td>
                          <td class="numeric">{decimalAmount(customerOrderTotal(order), numberFormat())}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </SortableTable>
                {!entry().orders.length && <p class="empty">No orders yet.</p>}
              </div>
            </Panel>
          </>
        )}
      </Show>
    </section>
  );
}
