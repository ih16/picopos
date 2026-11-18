import { money } from '../../shared/lib/format';
import { workbookCurrency } from '../../domain/settings';
import { component$, useContext, useSignal, useStore } from '@builder.io/qwik';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { orderPath } from '../../app/navigation/screen-route';
import {
  getInventory,
  getShippingOptions,
  makeId,
  PAYMENT_STATUSES,
  type RowChange,
} from '../../domain/workbook';
import { Accordion, ActionBar, Button, Input, SelectField, Textarea } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductPhoto } from '../../shared/ui/product-thumbnail';

import { emptyDraft, quantityLabel } from './order-helpers';
import type { DraftForm, OrdersProps } from './order-types';
import type { Order, PaymentStatus } from '../../domain/workbook';

export const CreateOrder = component$<OrdersProps>(({ data, busy, onCommit$, saveError }) => {
  const { navigate$, close$ } = useContext(ScreenNavigation);
  const error = useSignal('');
  const nextLineKey = useSignal(1);
  const draft = useStore<DraftForm>(emptyDraft());
  const customerSectionOpen = useSignal(true);
  const itemsSectionOpen = useSignal(true);
  const paymentSectionOpen = useSignal(true);
  let shippingOptions: ReturnType<typeof getShippingOptions> = [];
  let shippingError = '';
  try {
    shippingOptions = getShippingOptions(data);
  } catch (cause) {
    shippingError = (cause as Error).message;
  }
  const currency = workbookCurrency(data);
  const products = new Map(data.Products.map((product) => [product.id, product]));
  const variants = new Map(data.Variants.map((variant) => [variant.id, variant]));
  const activeVariants = data.Variants.filter(
    (variant) => variant.active && products.get(variant.productId)?.active,
  );
  const balances = new Map(getInventory(data).map((entry) => [entry.variantId, entry]));
  const chosenLines = draft.lines.filter((line) => variants.has(line.variantId));
  const totalUnits = chosenLines.reduce((sum, line) => sum + (line.quantity || 0), 0);
  const subtotal = chosenLines.reduce(
    (total, line) => total + (variants.get(line.variantId)?.price ?? 0) * (line.quantity || 0),
    0,
  );
  const shippingOption = shippingOptions.find((option) => option.id === draft.shippingOptionId);
  const draftShippingCharge = shippingOption?.rate ?? Number(draft.shippingCharge);
  const draftTotal = subtotal - Number(draft.discount) + draftShippingCharge;

  return (
    <div class="stack record-page">
      <div class="order-header">
        <h1>New order</h1>
      </div>
      <form
        class="stack order-draft-form"
        noValidate
        preventdefault:submit
        onSubmit$={async (_, form) => {
          error.value = '';
          for (const line of draft.lines) {
            const input = form.elements.namedItem(`quantity-${line.key}`);
            if (input instanceof HTMLInputElement) line.quantity = input.valueAsNumber;
          }
          if (!draft.customer.trim()) {
            customerSectionOpen.value = true;
            error.value = 'Enter the customer name.';
            return;
          }
          const discount = Number(draft.discount);
          if (shippingOptions.length && !shippingOption) {
            paymentSectionOpen.value = true;
            error.value = 'Choose a shipping option.';
            return;
          }
          if (shippingError || (draft.shippingOptionId && !shippingOption)) {
            paymentSectionOpen.value = true;
            error.value = shippingError || 'This shipping option was removed. Choose another option.';
            return;
          }
          const shippingCharge = draftShippingCharge;
          if (
            !Number.isFinite(discount) ||
            !Number.isFinite(shippingCharge) ||
            discount < 0 ||
            shippingCharge < 0
          ) {
            paymentSectionOpen.value = true;
            error.value = 'Enter a nonnegative discount and shipping charge.';
            return;
          }
          const orderId = makeId();
          const order: Order = {
            id: orderId,
            number: `P-${orderId.slice(0, 8).toUpperCase()}`,
            createdAt: new Date().toISOString(),
            customerId: draft.customerId,
            customer: draft.customer.trim(),
            contact: draft.contact.trim(),
            address: draft.address.trim(),
            status: 'Draft',
            paymentStatus: draft.paymentStatus,
            notes: draft.notes.trim(),
            discount,
            shippingCharge,
            shippingOption: shippingOption?.name ?? '',
          };
          const changes: RowChange[] = [{ tab: 'Orders', row: order }];
          let subtotal = 0;
          for (const [index, line] of draft.lines.entries()) {
            const variant = data.Variants.find((entry) => entry.id === line.variantId && entry.active);
            const product =
              variant && data.Products.find((entry) => entry.id === variant.productId && entry.active);
            if (!variant || !product) {
              itemsSectionOpen.value = true;
              error.value = `Choose an active variant for item ${index + 1}.`;
              return;
            }
            if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
              itemsSectionOpen.value = true;
              error.value = `Enter a whole quantity of 1 or more for item ${index + 1}.`;
              return;
            }
            subtotal += line.quantity * variant.price;
            changes.push({
              tab: 'Order Items',
              row: {
                id: makeId(),
                orderId,
                variantId: variant.id,
                productName: product.name,
                variantName: variant.optionValues || 'Default',
                sku: variant.sku,
                quantity: line.quantity,
                unitPrice: variant.price,
              },
            });
          }
          if (discount > subtotal) {
            paymentSectionOpen.value = true;
            error.value = 'The discount cannot exceed the items subtotal.';
            return;
          }
          if (await onCommit$(changes)) {
            await navigate$(orderPath(orderId), true);
          }
        }}
      >
        <Accordion.Root multiple collapsible class="form-accordion stack">
          <Accordion.Item value="customer" bind:open={customerSectionOpen} class="panel form-section">
            <Accordion.Header>
              <Accordion.Trigger type="button" class="form-section-trigger">
                <span>Customer</span>
                <span class="form-section-summary">{draft.customer || 'Choose or enter a customer'}</span>
                <span class="control-chevron" aria-hidden="true" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content class="form-section-content stack">
              <div class="order-customer-layout">
                <div class="order-customer-source stack">
                  <div>
                    <h3>Customer directory</h3>
                    <p class="muted">
                      Choose a saved customer to fill in their details, or enter them manually.
                    </p>
                  </div>
                  <SelectField
                    label="Saved customer"
                    placeholder="Search customer directory"
                    value={draft.customerId}
                    options={[
                      { value: '', label: 'Enter customer manually' },
                      ...data.Customers.filter((customer) => customer.active).map((customer) => ({
                        value: customer.id,
                        label: `${customer.name}${customer.contact ? ` · ${customer.contact}` : ''}`,
                      })),
                    ]}
                    onChange$={(value) => {
                      draft.customerId = value;
                      const customer = data.Customers.find((entry) => entry.id === value);
                      if (customer) {
                        draft.customer = customer.name;
                        draft.contact = customer.contact;
                        draft.address = customer.address;
                      }
                    }}
                  />
                </div>
                <div class="form-grid customer-fields">
                  <label class="field">
                    <span>
                      Customer name{' '}
                      <span class="field-required" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <Input
                      required
                      autoComplete="section-order shipping name"
                      value={draft.customer}
                      onInput$={(_, input) => {
                        draft.customer = input.value;
                      }}
                    />
                  </label>
                  <label class="field">
                    Phone or email
                    <Input
                      value={draft.contact}
                      onInput$={(_, input) => {
                        draft.contact = input.value;
                      }}
                    />
                  </label>
                  <label class="field">
                    Delivery address
                    <Textarea
                      rows={3}
                      autocomplete="section-order shipping street-address"
                      value={draft.address}
                      onInput$={(_, input) => {
                        draft.address = input.value;
                      }}
                    />
                  </label>
                  <label class="field">
                    Order notes
                    <Textarea
                      rows={3}
                      placeholder="Delivery instructions or other details"
                      value={draft.notes}
                      onInput$={(_, input) => {
                        draft.notes = input.value;
                      }}
                    />
                  </label>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="items" bind:open={itemsSectionOpen} class="panel form-section">
            <Accordion.Header>
              <Accordion.Trigger type="button" class="form-section-trigger">
                <span>Order items</span>
                <span class="form-section-summary">{quantityLabel(totalUnits)}</span>
                <span class="control-chevron" aria-hidden="true" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content class="form-section-content stack">
              {activeVariants.length === 0 ? (
                <p class="empty">Add an active product and variant in Catalog to create an order.</p>
              ) : (
                <>
                  {draft.lines.map((line, index) => {
                    const variant = variants.get(line.variantId);
                    const product = variant && products.get(variant.productId);
                    const available = variant ? (balances.get(variant.id)?.available ?? 0) : 0;
                    const shortage = !!variant && line.quantity > available;
                    return (
                      <div key={line.key} class="order-line stack">
                        <div class="panel-heading">
                          <div class="row order-item-heading">
                            {product && (
                              <ProductPhoto
                                name={product.name}
                                value={product.image}
                                class="order-item-photo"
                              />
                            )}
                            <div>
                              <h3>{product?.name || `Item ${index + 1}`}</h3>
                              {variant && (
                                <p class="muted">
                                  {variant.optionValues || 'Default'} · {variant.sku}
                                </p>
                              )}
                            </div>
                          </div>
                          {draft.lines.length > 1 && (
                            <Button
                              type="button"
                              class="secondary"
                              disabled={busy}
                              aria-label={`Remove item ${index + 1}`}
                              onClick$={() => {
                                draft.lines = draft.lines.filter((entry) => entry.key !== line.key);
                              }}
                            >
                              <Icon name="close" /> Remove
                            </Button>
                          )}
                        </div>
                        <SelectField
                          label={`Product / variant ${index + 1}`}
                          placeholder="Search product or SKU"
                          value={line.variantId}
                          disabled={busy}
                          options={activeVariants.map((choice) => ({
                            value: choice.id,
                            image: products.get(choice.productId)?.image,
                            imageName: products.get(choice.productId)?.name || 'Product',
                            label: `${products.get(choice.productId)?.name ?? ''} · ${choice.optionValues || 'Default'} · ${choice.sku} · ${money(choice.price, currency)}`,
                            disabled: draft.lines.some(
                              (other) => other.key !== line.key && other.variantId === choice.id,
                            ),
                          }))}
                          onChange$={(value) => {
                            line.variantId = value;
                          }}
                        />
                        <div class="order-line-controls">
                          <div class="field">
                            <label for={`order-quantity-${line.key}`}>Quantity</label>
                            <div class="quantity-stepper">
                              <Button
                                type="button"
                                class="secondary"
                                disabled={busy || !(line.quantity > 1)}
                                aria-label={`Decrease quantity for item ${index + 1}`}
                                onClick$={() => {
                                  line.quantity = Math.max(1, line.quantity - 1);
                                }}
                              >
                                −
                              </Button>
                              <Input
                                id={`order-quantity-${line.key}`}
                                name={`quantity-${line.key}`}
                                required
                                type="number"
                                inputMode="numeric"
                                min={1}
                                step={1}
                                value={line.quantity || ''}
                                onInput$={(_, input) => {
                                  line.quantity = input.valueAsNumber;
                                }}
                              />
                              <Button
                                type="button"
                                class="secondary"
                                disabled={busy}
                                aria-label={`Increase quantity for item ${index + 1}`}
                                onClick$={() => {
                                  line.quantity = (line.quantity || 0) + 1;
                                }}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                          {variant && (
                            <div class="order-line-price">
                              <strong>{money(variant.price * (line.quantity || 0), currency)}</strong>
                              <span class="muted">{money(variant.price, currency)} each</span>
                            </div>
                          )}
                        </div>
                        {variant && (
                          <p class={shortage ? 'negative' : 'muted'}>
                            {available} available
                            {shortage ? ' · More stock is needed before confirmation.' : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div class="row">
                    <Button
                      type="button"
                      class="secondary"
                      disabled={busy || draft.lines.length >= activeVariants.length}
                      onClick$={() => {
                        draft.lines.push({ key: nextLineKey.value++, variantId: '', quantity: 1 });
                      }}
                    >
                      <Icon name="plus" /> Add item
                    </Button>
                  </div>
                </>
              )}
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="payment" bind:open={paymentSectionOpen} class="panel form-section">
            <Accordion.Header>
              <Accordion.Trigger type="button" class="form-section-trigger">
                <span>Payment, discount and shipping</span>
                <span class="form-section-summary">{draft.paymentStatus}</span>
                <span class="control-chevron" aria-hidden="true" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content class="form-section-content">
              <div class="form-grid">
                <SelectField
                  label="Payment status"
                  value={draft.paymentStatus}
                  onChange$={(value) => {
                    draft.paymentStatus = value as PaymentStatus;
                  }}
                  options={PAYMENT_STATUSES.map((value) => ({ value, label: value }))}
                />
                <label class="field">
                  Discount ({currency})
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0"
                    value={draft.discount}
                    onInput$={(_, input) => {
                      draft.discount = input.value === '' ? '' : input.valueAsNumber;
                    }}
                  />
                </label>
                {shippingOptions.length > 0 ? (
                  <SelectField
                    label="Shipping option"
                    value={draft.shippingOptionId}
                    required
                    placeholder="Choose shipping"
                    options={shippingOptions.map((option) => ({
                      value: option.id,
                      label: `${option.name} · ${money(option.rate, currency)}`,
                    }))}
                    onChange$={(value) => {
                      draft.shippingOptionId = value;
                    }}
                  />
                ) : (
                  <label class="field">
                    Shipping charge ({currency})
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="0"
                      value={draft.shippingCharge}
                      onInput$={(_, input) => {
                        draft.shippingCharge = input.value === '' ? '' : input.valueAsNumber;
                        draft.shippingOptionId = '';
                      }}
                    />
                  </label>
                )}
                {shippingError && (
                  <p class="notice error" role="alert">
                    {shippingError} Update shipping options in Settings.
                  </p>
                )}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
        <ActionBar label="Order actions" class="order-save-bar">
          {error.value && (
            <p class="notice error order-save-error" role="alert">
              {error.value}
            </p>
          )}
          {!error.value && saveError && <p class="notice error order-save-error">{saveError}</p>}
          <div class="order-save-total">
            <span class="muted">Total · {quantityLabel(totalUnits)}</span>
            <strong>{money(draftTotal, currency)}</strong>
          </div>
          <Button class="secondary" disabled={busy} onClick$={close$}>
            Cancel
          </Button>
          <Button type="submit" class="primary" disabled={busy || !activeVariants.length}>
            {busy ? 'Saving…' : 'Create draft'}
          </Button>
        </ActionBar>
      </form>
    </div>
  );
});
