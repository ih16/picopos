import { createMemo, createSignal, createStore, For, Show, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { orderPath } from '../../app/navigation/screen-route';
import { lineSubtotal, orderTotal } from '../../domain/order-totals';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import type { Order, PaymentStatus } from '../../domain/workbook';
import {
  getInventory,
  getShippingOptions,
  makeId,
  PAYMENT_STATUSES,
  type RowChange,
} from '../../domain/workbook';
import { money } from '../../shared/lib/format';
import { ActionBar, Button, Input, SelectField, Textarea } from '../../shared/ui/controls';
import { ProductPhoto } from '../../shared/ui/product-thumbnail';
import { emptyDraft, quantityLabel } from './order-helpers';
import type { DraftForm, OrdersProps } from './order-types';

export function CreateOrder(props: OrdersProps) {
  const { navigate, close } = useContext(ScreenNavigation);
  const [error, setError] = createSignal('');
  let nextLineKey = 1;
  const [draft, setDraft] = createStore<DraftForm>(emptyDraft());
  const [customerSectionOpen, setCustomerSectionOpen] = createSignal(true);
  const [itemsSectionOpen, setItemsSectionOpen] = createSignal(true);
  const [paymentSectionOpen, setPaymentSectionOpen] = createSignal(true);
  const shipping = createMemo(() => {
    let shippingOptions: ReturnType<typeof getShippingOptions> = [];
    let shippingError = '';
    try {
      shippingOptions = getShippingOptions(props.data);
    } catch (cause) {
      shippingError = (cause as Error).message;
    }
    return { shippingOptions, shippingError };
  });
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));
  const products = createMemo(() => new Map(props.data.Products.map((product) => [product.id, product])));
  const variants = createMemo(() => new Map(props.data.Variants.map((variant) => [variant.id, variant])));
  const activeVariants = createMemo(() =>
    props.data.Variants.filter((variant) => variant.active && products().get(variant.productId)?.active),
  );
  const balances = createMemo(
    () => new Map(getInventory(props.data).map((entry) => [entry.variantId, entry])),
  );
  const chosenLines = createMemo(() => draft.lines.filter((line) => variants().has(line.variantId)));
  const totalUnits = createMemo(() => chosenLines().reduce((sum, line) => sum + (line.quantity || 0), 0));
  const subtotal = createMemo(() =>
    chosenLines().reduce(
      (total, line) => total + lineSubtotal(line.quantity || 0, variants().get(line.variantId)?.price ?? 0),
      0,
    ),
  );
  const shippingOption = createMemo(() =>
    shipping().shippingOptions.find((option) => option.id === draft.shippingOptionId),
  );
  const draftShippingCharge = createMemo(() => shippingOption()?.rate ?? Number(draft.shippingCharge));
  const draftTotal = createMemo(() =>
    orderTotal(subtotal(), {
      discount: Number(draft.discount),
      shippingCharge: draftShippingCharge(),
    }),
  );

  return (
    <div class="stack record-page new-order-page">
      <div class="order-header">
        <h1>New order</h1>
      </div>
      <form
        class="stack order-draft-form"
        novalidate
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          setError('');
          if (!draft.customer.trim()) {
            setCustomerSectionOpen(true);
            setError('Enter the customer name.');
            return;
          }
          const discount = Number(draft.discount);
          if (shipping().shippingOptions.length && !shippingOption()) {
            setPaymentSectionOpen(true);
            setError('Choose a shipping option.');
            return;
          }
          if (shipping().shippingError || (draft.shippingOptionId && !shippingOption())) {
            setPaymentSectionOpen(true);
            setError(shipping().shippingError || 'This shipping option was removed. Choose another option.');
            return;
          }
          const shippingCharge = draftShippingCharge();
          if (
            !Number.isFinite(discount) ||
            !Number.isFinite(shippingCharge) ||
            discount < 0 ||
            shippingCharge < 0
          ) {
            setPaymentSectionOpen(true);
            setError('Enter a nonnegative discount and shipping charge.');
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
            shippingOption: shippingOption()?.name ?? '',
          };
          const changes: RowChange[] = [{ tab: 'Orders', row: order }];
          let subtotal = 0;
          for (const [index, line] of draft.lines.entries()) {
            const variant = props.data.Variants.find((entry) => entry.id === line.variantId && entry.active);
            const product =
              variant && props.data.Products.find((entry) => entry.id === variant.productId && entry.active);
            if (!variant || !product) {
              setItemsSectionOpen(true);
              setError(`Choose an active variant for item ${index + 1}.`);
              return;
            }
            const input = form.elements.namedItem(`quantity-${line.key}`);
            const quantity = input instanceof HTMLInputElement ? input.valueAsNumber : line.quantity;
            if (!Number.isSafeInteger(quantity) || quantity < 1) {
              setItemsSectionOpen(true);
              setError(`Enter a whole quantity of 1 or more for item ${index + 1}.`);
              return;
            }
            subtotal += lineSubtotal(quantity, variant.price);
            changes.push({
              tab: 'Order Items',
              row: {
                id: makeId(),
                orderId,
                variantId: variant.id,
                productName: product.name,
                variantName: variant.optionValues || 'Default',
                sku: variant.sku,
                quantity,
                unitPrice: variant.price,
              },
            });
          }
          if (discount > subtotal) {
            setPaymentSectionOpen(true);
            setError('The discount cannot exceed the items subtotal.');
            return;
          }
          if (await props.onCommit(changes)) {
            await navigate(orderPath(orderId), true);
          }
        }}
      >
        <div class="form-accordion stack">
          <details
            open={customerSectionOpen()}
            onToggle={(event) => {
              setCustomerSectionOpen(event.currentTarget.open);
            }}
            class="panel form-section"
          >
            <summary class="form-section-trigger">
              <span>Customer</span>
              <span class="form-section-summary">{draft.customer || 'Choose or enter a customer'}</span>
              <span class="control-chevron" aria-hidden="true" />
            </summary>
            <div class="form-section-content stack">
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
                      ...props.data.Customers.filter((customer) => customer.active).map((customer) => ({
                        value: customer.id,
                        label: `${customer.name}${customer.contact ? ` · ${customer.contact}` : ''}`,
                      })),
                    ]}
                    onChange={(value) => {
                      setDraft((draft) => {
                        draft.customerId = value;
                      });
                      const customer = props.data.Customers.find((entry) => entry.id === value);
                      if (customer) {
                        setDraft((draft) => {
                          draft.customer = customer.name;
                        });
                        setDraft((draft) => {
                          draft.contact = customer.contact;
                        });
                        setDraft((draft) => {
                          draft.address = customer.address;
                        });
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
                      autocomplete="section-order shipping name"
                      value={draft.customer}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setDraft((draft) => {
                          draft.customer = input.value;
                        });
                      }}
                    />
                  </label>
                  <label class="field">
                    Phone or email
                    <Input
                      value={draft.contact}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setDraft((draft) => {
                          draft.contact = input.value;
                        });
                      }}
                    />
                  </label>
                  <label class="field">
                    Delivery address
                    <Textarea
                      rows={3}
                      autocomplete="section-order shipping street-address"
                      value={draft.address}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setDraft((draft) => {
                          draft.address = input.value;
                        });
                      }}
                    />
                  </label>
                  <label class="field">
                    Order notes
                    <Textarea
                      rows={3}
                      placeholder="Delivery instructions or other details"
                      value={draft.notes}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setDraft((draft) => {
                          draft.notes = input.value;
                        });
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </details>
          <details
            open={itemsSectionOpen()}
            onToggle={(event) => {
              setItemsSectionOpen(event.currentTarget.open);
            }}
            class="panel form-section"
          >
            <summary class="form-section-trigger">
              <span>Order items</span>
              <span class="form-section-summary">{quantityLabel(totalUnits())}</span>
              <span class="control-chevron" aria-hidden="true" />
            </summary>
            <div class="form-section-content stack">
              {activeVariants().length === 0 ? (
                <p class="empty">Add an active product and variant in Catalog to create an order.</p>
              ) : (
                <>
                  <For each={draft.lines} keyed={(row) => row.key}>
                    {(line, index) => {
                      const variant = createMemo(() => variants().get(line().variantId));
                      const product = createMemo(() => products().get(variant()?.productId ?? ''));
                      const available = createMemo(() => balances().get(line().variantId)?.available ?? 0);
                      const shortage = createMemo(() => !!variant() && line().quantity > available());
                      return (
                        <div class="order-line stack">
                          <div class="panel-heading">
                            <div class="row order-item-heading">
                              <Show when={product()}>
                                {(item) => (
                                  <ProductPhoto
                                    name={item().name}
                                    value={item().image}
                                    class="order-item-photo"
                                  />
                                )}
                              </Show>
                              <div>
                                <h3>{product()?.name || `Item ${index() + 1}`}</h3>
                                <Show when={variant()}>
                                  {(item) => (
                                    <p class="muted">
                                      {item().optionValues || 'Default'} · {item().sku}
                                    </p>
                                  )}
                                </Show>
                              </div>
                            </div>
                            {draft.lines.length > 1 && (
                              <Button
                                type="button"
                                class="secondary"
                                disabled={props.busy}
                                aria-label={`Remove item ${index() + 1}`}
                                onClick={() => {
                                  setDraft((draft) => {
                                    draft.lines = draft.lines.filter((entry) => entry.key !== line().key);
                                  });
                                }}
                                icon="close"
                                mobileIconOnly
                                label="Remove"
                              />
                            )}
                          </div>
                          <SelectField
                            label={`Product / variant ${index() + 1}`}
                            placeholder="Search product or SKU"
                            value={line().variantId}
                            disabled={props.busy}
                            options={activeVariants().map((choice) => ({
                              value: choice.id,
                              image: products().get(choice.productId)?.image,
                              imageName: products().get(choice.productId)?.name || 'Product',
                              label: `${products().get(choice.productId)?.name ?? ''} · ${choice.optionValues || 'Default'} · ${choice.sku} · ${money(choice.price, currency(), numberFormat())}`,
                              disabled: draft.lines.some(
                                (other) => other.key !== line().key && other.variantId === choice.id,
                              ),
                            }))}
                            onChange={(value) => {
                              setDraft((draft) => {
                                draft.lines[index()].variantId = value;
                              });
                            }}
                          />
                          <div class="order-line-controls">
                            <div class="field">
                              <label for={`order-quantity-${line().key}`}>Quantity</label>
                              <div class="quantity-stepper">
                                <Button
                                  type="button"
                                  class="secondary"
                                  disabled={props.busy || !(line().quantity > 1)}
                                  aria-label={`Decrease quantity for item ${index() + 1}`}
                                  onClick={() => {
                                    setDraft((draft) => {
                                      draft.lines[index()].quantity = Math.max(1, line().quantity - 1);
                                    });
                                  }}
                                >
                                  −
                                </Button>
                                <Input
                                  id={`order-quantity-${line().key}`}
                                  name={`quantity-${line().key}`}
                                  required
                                  type="number"
                                  inputmode="numeric"
                                  min={1}
                                  step={1}
                                  value={line().quantity || ''}
                                  onInput={(event) => {
                                    const input = event.currentTarget;
                                    setDraft((draft) => {
                                      draft.lines[index()].quantity = input.valueAsNumber;
                                    });
                                  }}
                                />
                                <Button
                                  type="button"
                                  class="secondary"
                                  disabled={props.busy}
                                  aria-label={`Increase quantity for item ${index() + 1}`}
                                  onClick={() => {
                                    setDraft((draft) => {
                                      draft.lines[index()].quantity = (line().quantity || 0) + 1;
                                    });
                                  }}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            <Show when={variant()}>
                              {(item) => (
                                <div class="order-line-price">
                                  <strong>
                                    {money(
                                      lineSubtotal(line().quantity || 0, item().price),
                                      currency(),
                                      numberFormat(),
                                    )}
                                  </strong>
                                  <span class="muted">
                                    {money(item().price, currency(), numberFormat())} each
                                  </span>
                                </div>
                              )}
                            </Show>
                          </div>
                          {variant() && (
                            <p class={shortage() ? 'negative' : 'muted'}>
                              {available()} available
                              {shortage() ? ' · More stock is needed before confirmation.' : ''}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  </For>
                  <div class="row">
                    <Button
                      type="button"
                      class="secondary"
                      disabled={props.busy || draft.lines.length >= activeVariants().length}
                      onClick={() => {
                        setDraft((draft) => {
                          draft.lines.push({ key: nextLineKey++, variantId: '', quantity: 1 });
                        });
                      }}
                      icon="plus"
                      label="Add item"
                    />
                  </div>
                </>
              )}
            </div>
          </details>
          <details
            open={paymentSectionOpen()}
            onToggle={(event) => {
              setPaymentSectionOpen(event.currentTarget.open);
            }}
            class="panel form-section"
          >
            <summary class="form-section-trigger">
              <span>Payment, discount and shipping</span>
              <span class="form-section-summary">{draft.paymentStatus}</span>
              <span class="control-chevron" aria-hidden="true" />
            </summary>
            <div class="form-section-content">
              <div class="form-grid">
                <SelectField
                  label="Payment status"
                  value={draft.paymentStatus}
                  onChange={(value) => {
                    setDraft((draft) => {
                      draft.paymentStatus = value as PaymentStatus;
                    });
                  }}
                  options={PAYMENT_STATUSES.map((value) => ({ value, label: value }))}
                />
                <label class="field">
                  Discount ({currency()})
                  <Input
                    type="number"
                    inputmode="decimal"
                    step="any"
                    placeholder="0"
                    value={draft.discount}
                    onInput={(event) => {
                      const input = event.currentTarget;
                      setDraft((draft) => {
                        draft.discount = input.value === '' ? '' : input.valueAsNumber;
                      });
                    }}
                  />
                </label>
                {shipping().shippingOptions.length > 0 ? (
                  <SelectField
                    label="Shipping option"
                    value={draft.shippingOptionId}
                    required
                    placeholder="Choose shipping"
                    options={shipping().shippingOptions.map((option) => ({
                      value: option.id,
                      label: `${option.name} · ${money(option.rate, currency(), numberFormat())}`,
                    }))}
                    onChange={(value) => {
                      setDraft((draft) => {
                        draft.shippingOptionId = value;
                      });
                    }}
                  />
                ) : (
                  <label class="field">
                    Shipping charge ({currency()})
                    <Input
                      type="number"
                      inputmode="decimal"
                      step="any"
                      placeholder="0"
                      value={draft.shippingCharge}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        setDraft((draft) => {
                          draft.shippingCharge = input.value === '' ? '' : input.valueAsNumber;
                        });
                        setDraft((draft) => {
                          draft.shippingOptionId = '';
                        });
                      }}
                    />
                  </label>
                )}
                {shipping().shippingError && (
                  <p class="notice error" role="alert">
                    {shipping().shippingError} Update shipping options in Settings.
                  </p>
                )}
              </div>
            </div>
          </details>
        </div>
        <ActionBar label="Order actions" class="order-save-bar">
          {error() && (
            <p class="notice error order-save-error" role="alert">
              {error()}
            </p>
          )}
          {!error() && props.saveError && <p class="notice error order-save-error">{props.saveError}</p>}
          <div class="order-save-total">
            <span class="muted">Total · {quantityLabel(totalUnits())}</span>
            <strong>{money(draftTotal(), currency(), numberFormat())}</strong>
          </div>
          <Button
            class="secondary"
            disabled={props.busy}
            onClick={close}
            mobileIconOnly
            icon="close"
            label="Cancel"
          />
          <Button
            type="submit"
            class="primary"
            disabled={props.busy || !activeVariants().length}
            mobileIconOnly
            icon="save"
            label={props.busy ? 'Saving…' : 'Create draft'}
          />
        </ActionBar>
      </form>
    </div>
  );
}
