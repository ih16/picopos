import { decimalAmount } from '../../shared/lib/format';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
import { $, component$, useContext, useSignal, useTask$, type QRL } from '@builder.io/qwik';
import { Collapsible } from '@qwik-ui/headless';
import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import {
  categoryPath,
  makeId,
  type Product,
  type RowChange,
  type Variant,
  type WorkbookData,
} from '../../domain/workbook';
import {
  ActionBar,
  EditorForm,
  Badge,
  Button,
  Input,
  Modal,
  MultiSelect,
  Panel,
  SelectField,
  Table,
  Switch,
  Textarea,
} from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductLabel, ProductPhoto } from '../../shared/ui/product-thumbnail';
import { ReconnectNotice } from '../auth/connection';
import {
  newProduct,
  newVariant,
  optionNamesOf,
  optionSeparator,
  readVariantOptions,
  statusOptions,
  validateOptionValues,
  type ProductOption,
  type VariantOption,
} from './catalog-options';
import { ProductImageInput } from './product-photo';

type Props = {
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit$: QRL<(changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>>;
};
export const Catalog = component$<Props>(({ data, busy, error, onCommit$ }) => {
  const { route, navigate$ } = useContext(ScreenNavigation);
  const subpage = useSignal<'products' | 'categories'>('products');
  useTask$(({ track }) => {
    const screen = track(() => route.value);
    if (screen.page === 'Catalog') subpage.value = screen.catalogPage;
  });
  const categorySearch = useSignal('');
  const categoryParent = useSignal('');
  const search = useSignal('');
  const category = useSignal<string[]>([]);
  const status = useSignal<string[]>([]);
  const editor = useSignal<'product' | 'variant' | 'category'>('product');
  const editorOpen = useSignal(false);
  const attemptedSave = useSignal(false);
  const editBase = useSignal<RowChange[]>([]);
  const product = useSignal(newProduct(''));
  const variant = useSignal(newVariant(''));
  const categoryName = useSignal('');
  const categoryId = useSignal('');
  const firstSku = useSignal('');
  const firstPrice = useSignal(0);
  const productOptions = useSignal<ProductOption[]>([]);
  const variantOptions = useSignal<VariantOption[]>([]);
  const optionError = useSignal('');
  const productEditKey = useSignal('');
  const photoProcessing = useSignal(false);

  const categoryNames = new Map(
    data.Categories.map(({ id }) => [
      id,
      categoryPath(data.Categories, id)
        .map((row) => row.name)
        .join(' / '),
    ]),
  );
  const categoryOptions = data.Categories.map(({ id }) => ({
    value: id,
    label: categoryNames.get(id)!,
  })).sort((a, b) => a.label.localeCompare(b.label));
  const shownCategories = categoryOptions.filter((row) =>
    row.label.toLowerCase().includes(categorySearch.value.trim().toLowerCase()),
  );
  const variantsByProduct = new Map<string, Variant[]>();
  for (const item of data.Variants) {
    const variants = variantsByProduct.get(item.productId);
    if (variants) variants.push(item);
    else variantsByProduct.set(item.productId, [item]);
  }
  const query = search.value.trim().toLowerCase();
  const hasFilters = Boolean(query || category.value.length || status.value.length);
  const shown = data.Products.filter((item) => {
    if (
      category.value.length &&
      !categoryPath(data.Categories, item.categoryId).some((row) => category.value.includes(row.id))
    )
      return false;
    if (status.value.length && !status.value.includes(item.active ? 'active' : 'archived')) return false;
    const variantText = (variantsByProduct.get(item.id) ?? [])
      .map((row) => `${row.sku} ${row.optionValues}`)
      .join(' ');
    return !query || `${item.name} ${variantText}`.toLowerCase().includes(query);
  });
  const currency = workbookCurrency(data);
  const numberFormat = workbookNumberFormat(data);
  const editorTitle =
    editor.value === 'category'
      ? categoryId.value
        ? 'Edit category'
        : 'New category'
      : editor.value === 'variant'
        ? variant.value.id
          ? 'Edit variant'
          : 'New variant'
        : product.value.id
          ? 'Edit product'
          : 'New product';

  const clearFilters = $(() => {
    search.value = '';
    category.value = [];
    status.value = [];
  });

  const openCategory = $((id = '', parentId = '') => {
    const existing = data.Categories.find((row) => row.id === id);
    editBase.value = existing ? [{ tab: 'Categories', row: existing }] : [];
    categoryParent.value = existing?.parentId || parentId;
    categoryId.value = id;
    categoryName.value = existing?.name || '';
    editor.value = 'category';
    attemptedSave.value = false;
    optionError.value = '';
    editorOpen.value = true;
  });

  const openProduct = $((item?: Product) => {
    editBase.value = item ? [{ tab: 'Products', row: item }] : [];
    productEditKey.value = makeId();
    photoProcessing.value = false;
    product.value = item ? { ...item } : newProduct(category.value.length === 1 ? category.value[0] : '');
    const hasVariants = Boolean(item && data.Variants.some((row) => row.productId === item.id));
    productOptions.value = optionNamesOf(item?.optionNames ?? '').map((name) => ({
      id: makeId(),
      name,
      firstValue: '',
      saved: hasVariants,
    }));
    firstSku.value = '';
    firstPrice.value = 0;
    editor.value = 'product';
    attemptedSave.value = false;
    optionError.value = '';
    editorOpen.value = true;
  });

  const openVariant = $((item: Variant) => {
    editBase.value = item.id ? [{ tab: 'Variants', row: item }] : [];
    variant.value = {
      ...item,
      price: item.id
        ? item.price
        : (data.Variants.find((row) => row.productId === item.productId && row.active)?.price ?? item.price),
    };
    const names = optionNamesOf(data.Products.find((row) => row.id === item.productId)?.optionNames ?? '');
    variantOptions.value = readVariantOptions(names, item.optionValues);
    editor.value = 'variant';
    attemptedSave.value = false;
    optionError.value = '';
    editorOpen.value = true;
  });

  const addOption = $(() => {
    productOptions.value = [
      ...productOptions.value,
      { id: makeId(), name: '', firstValue: '', saved: false },
    ];
    optionError.value = '';
  });

  const closeEditor = $(() => {
    editorOpen.value = false;
  });
  const saveCategory = $(async () => {
    attemptedSave.value = true;
    if (
      await onCommit$(
        [
          {
            tab: 'Categories',
            row: {
              id: categoryId.value || makeId(),
              name: categoryName.value.trim(),
              parentId: categoryParent.value,
            },
          },
        ],
        editBase.value,
      )
    ) {
      editorOpen.value = false;
    }
  });

  const saveProduct = $(async () => {
    if (photoProcessing.value) return;
    attemptedSave.value = false;
    optionError.value = '';
    const names = productOptions.value.map(({ name }) => name.trim());
    const namesChanged =
      names.join(optionSeparator) !== optionNamesOf(product.value.optionNames).join(optionSeparator);
    if (namesChanged && names.some((name) => !name || name.includes('/'))) {
      optionError.value = 'Enter one option name per field, such as Color or Size.';
      return;
    }
    if (namesChanged && new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) {
      optionError.value = 'Give each option a different name.';
      return;
    }
    const firstValues = productOptions.value.map(({ firstValue }) => firstValue.trim());
    if (!product.value.id) {
      optionError.value = validateOptionValues(firstValues);
      if (optionError.value) return;
    }
    attemptedSave.value = true;
    const id = product.value.id || makeId();
    const changes: RowChange[] = [
      {
        tab: 'Products',
        row: {
          ...product.value,
          id,
          name: product.value.name.trim(),
          optionNames: namesChanged ? names.join(optionSeparator) : product.value.optionNames,
        },
      },
    ];
    if (!product.value.id) {
      changes.push({
        tab: 'Variants',
        row: {
          ...newVariant(id),
          id: makeId(),
          sku: firstSku.value.trim(),
          price: firstPrice.value,
          optionValues: firstValues.join(optionSeparator),
        },
      });
    }
    if (await onCommit$(changes, editBase.value)) editorOpen.value = false;
  });

  const saveVariant = $(async () => {
    attemptedSave.value = false;
    optionError.value = '';
    const updateValues =
      !variant.value.id ||
      variantOptions.value.some((option) => option.value.trim() !== option.originalValue);
    const values = variantOptions.value.map((option) => option.value.trim());
    if (updateValues && values.length) {
      optionError.value = validateOptionValues(values);
      if (optionError.value) return;
    }
    attemptedSave.value = true;
    const row = {
      ...variant.value,
      id: variant.value.id || makeId(),
      sku: variant.value.sku.trim(),
      optionValues: updateValues && values.length ? values.join(optionSeparator) : variant.value.optionValues,
    };
    if (await onCommit$([{ tab: 'Variants', row }], editBase.value)) editorOpen.value = false;
  });

  const editorError = optionError.value || (attemptedSave.value ? error : '');
  const saveError = editorError ? (
    <p class="notice error" role="alert">
      {editorError}
    </p>
  ) : null;

  return (
    <section class="stack catalog-page">
      <h1 class="sr-only">Catalog</h1>
      <div class="catalog-toolbar">
        <nav class="row catalog-tabs" aria-label="Catalog pages">
          <Button
            class={subpage.value === 'products' ? '' : 'secondary'}
            aria-current={subpage.value === 'products' ? 'page' : undefined}
            onClick$={() => navigate$('/catalog')}
          >
            Products
          </Button>
          <Button
            class={subpage.value === 'categories' ? '' : 'secondary'}
            aria-current={subpage.value === 'categories' ? 'page' : undefined}
            onClick$={() => navigate$('/catalog/categories')}
          >
            Categories
          </Button>
        </nav>
        {subpage.value === 'products' ? (
          <>
            <div class="row filters catalog-filters">
              <label class="field catalog-search input-with-icon">
                <span class="sr-only">Search products</span>
                <Icon name="search" />
                <Input
                  controlSize="sm"
                  type="search"
                  placeholder="Name or SKU"
                  value={search.value}
                  onInput$={(_, el) => (search.value = el.value)}
                />
              </label>
              <MultiSelect
                controlSize="sm"
                label="Category"
                placeholder="All categories"
                value={category.value}
                options={categoryOptions}
                onChange$={(value) => {
                  category.value = value;
                }}
              />
              <MultiSelect
                controlSize="sm"
                placeholder="All statuses"
                label="Product status"
                value={status.value}
                options={statusOptions}
                onChange$={(value) => {
                  status.value = value;
                }}
              />
              {hasFilters && (
                <Button
                  class="secondary catalog-icon-button"
                  title="Clear filters"
                  aria-label="Clear filters"
                  onClick$={clearFilters}
                >
                  <Icon name="close" />
                </Button>
              )}
            </div>
            <p class="sr-only" aria-live="polite">
              {shown.length} of {data.Products.length} products
            </p>
          </>
        ) : (
          <div class="row filters catalog-filters">
            <label class="field catalog-search input-with-icon">
              <span class="sr-only">Search categories</span>
              <Icon name="search" />
              <Input
                controlSize="sm"
                placeholder="Search categories"
                type="search"
                value={categorySearch.value}
                onInput$={(_, el) => (categorySearch.value = el.value)}
              />
            </label>
          </div>
        )}
      </div>
      {!editorOpen.value && (
        <ActionBar class="record-shortcut" label="Catalog actions">
          {subpage.value === 'categories' ? (
            <Button onClick$={() => openCategory()} icon="category-add" label="Add category" />
          ) : (
            <Button onClick$={() => openProduct()} icon="product-add" label="Add product" />
          )}
        </ActionBar>
      )}

      <Modal open={editorOpen} title={editorTitle}>
        {editorOpen.value && <ReconnectNotice q:slot="notice" />}
        {editor.value === 'category' && (
          <EditorForm class="stack" preventdefault:submit onSubmit$={saveCategory}>
            <label class="field">
              Category name
              <Input
                required
                value={categoryName.value}
                onInput$={(_, el) => (categoryName.value = el.value)}
              />
            </label>
            <SelectField
              label="Parent category"
              value={categoryParent.value}
              onChange$={(value) => {
                categoryParent.value = value;
              }}
              options={[
                { value: '', label: 'None (top-level category)' },
                ...categoryOptions.filter(
                  (row) =>
                    !categoryPath(data.Categories, row.value).some(
                      (ancestor) => ancestor.id === categoryId.value,
                    ),
                ),
              ]}
            />
            {saveError}
            <ActionBar q:slot="actions" label="Editor actions">
              <Button class="secondary" onClick$={closeEditor} icon="close" label="Cancel" />
              <Button
                type="submit"
                disabled={busy}
                icon="save"
                label={busy ? 'Saving…' : categoryId.value ? 'Update category' : 'Save category'}
              />
            </ActionBar>
          </EditorForm>
        )}

        {editor.value === 'product' && (
          <EditorForm class="stack product-editor" preventdefault:submit onSubmit$={saveProduct}>
            <div class="form-grid">
              <label class="field">
                Product name
                <Input
                  required
                  value={product.value.name}
                  onInput$={(_, el) => (product.value = { ...product.value, name: el.value })}
                />
              </label>
              <SelectField
                label="Category"
                value={product.value.categoryId}
                onChange$={(value) => {
                  product.value = { ...product.value, categoryId: value };
                }}
                options={[{ value: '', label: 'Uncategorized' }, ...categoryOptions]}
              />
            </div>
            <label class="field">
              Description
              <Textarea
                value={product.value.description}
                onInput$={(_, el) => (product.value = { ...product.value, description: el.value })}
              />
            </label>
            <ProductImageInput
              key={productEditKey.value}
              value={product.value.image}
              editorVersion={productEditKey}
              processing={photoProcessing}
              disabled={busy}
              onChange$={(image) => {
                product.value = { ...product.value, image };
              }}
            />
            {productOptions.value.length > 0 ? (
              <fieldset class="option-fields stack">
                <legend>Options</legend>
                {productOptions.value.map((option, index) => (
                  <div class="option-name-row" key={option.id}>
                    <label class="field">
                      Option name {index + 1}
                      <Input
                        required
                        value={option.name}
                        placeholder={index === 0 ? 'e.g. Color' : 'e.g. Size'}
                        onInput$={(_, el) => {
                          productOptions.value = productOptions.value.map((row) =>
                            row.id === option.id ? { ...row, name: el.value } : row,
                          );
                          optionError.value = '';
                        }}
                      />
                    </label>
                    {!option.saved && (
                      <Button
                        class="secondary"
                        aria-label={`Remove option ${index + 1}`}
                        onClick$={() => {
                          productOptions.value = productOptions.value.filter((row) => row.id !== option.id);
                          optionError.value = '';
                        }}
                        icon="close"
                        label="Remove"
                      />
                    )}
                  </div>
                ))}
                <Button
                  class="secondary option-add"
                  onClick$={addOption}
                  icon="plus"
                  label="Add another option"
                />
              </fieldset>
            ) : (
              <Button class="secondary option-add" onClick$={addOption} icon="plus" label="Add options" />
            )}
            {!product.value.id && (
              <section class="stack" aria-labelledby="first-variant-title">
                <h3 id="first-variant-title">
                  {productOptions.value.length ? 'First variant' : 'SKU and price'}
                </h3>
                <div class="form-grid">
                  <label class="field">
                    SKU
                    <Input
                      required
                      value={firstSku.value}
                      onInput$={(_, el) => (firstSku.value = el.value)}
                    />
                  </label>
                  <label class="field">
                    Price ({currency})
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      required
                      value={Number.isNaN(firstPrice.value) ? '' : firstPrice.value}
                      onInput$={(_, el) => (firstPrice.value = el.valueAsNumber)}
                    />
                  </label>
                  {productOptions.value
                    .filter((option) => option.name.trim())
                    .map((option) => (
                      <label class="field" key={option.id}>
                        {option.name.trim()}
                        <Input
                          required
                          value={option.firstValue}
                          onInput$={(_, el) => {
                            productOptions.value = productOptions.value.map((row) =>
                              row.id === option.id ? { ...row, firstValue: el.value } : row,
                            );
                            optionError.value = '';
                          }}
                        />
                      </label>
                    ))}
                </div>
              </section>
            )}
            <Switch
              key={productEditKey.value}
              label="Active product"
              checked={product.value.active}
              onChange$={(_, input) => {
                product.value = { ...product.value, active: input.checked };
              }}
            />
            {saveError}
            <ActionBar q:slot="actions" label="Editor actions">
              <Button class="secondary" onClick$={closeEditor} icon="close" label="Cancel" />
              <Button
                type="submit"
                disabled={busy || photoProcessing.value}
                icon="save"
                label={busy ? 'Saving…' : product.value.id ? 'Update product' : 'Save product'}
              />
            </ActionBar>
          </EditorForm>
        )}

        {editor.value === 'variant' && (
          <EditorForm class="stack" preventdefault:submit onSubmit$={saveVariant}>
            <p class="muted">{data.Products.find(({ id }) => id === variant.value.productId)?.name}</p>
            <div class="form-grid">
              <label class="field">
                SKU
                <Input
                  required
                  value={variant.value.sku}
                  onInput$={(_, el) => (variant.value = { ...variant.value, sku: el.value })}
                />
              </label>
              {variantOptions.value.map((option, index) => (
                <label class="field" key={index}>
                  {option.name}
                  <Input
                    required={!variant.value.id}
                    value={option.value}
                    onInput$={(_, el) => {
                      variantOptions.value = variantOptions.value.map((row, position) =>
                        position === index ? { ...row, value: el.value } : row,
                      );
                      optionError.value = '';
                    }}
                  />
                </label>
              ))}
              {variantOptions.value.length === 0 && variant.value.optionValues && (
                <label class="field">
                  Variant label
                  <Input
                    value={variant.value.optionValues}
                    onInput$={(_, el) => (variant.value = { ...variant.value, optionValues: el.value })}
                  />
                </label>
              )}
              <label class="field">
                Price ({currency})
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                  value={Number.isNaN(variant.value.price) ? '' : variant.value.price}
                  onInput$={(_, el) => (variant.value = { ...variant.value, price: el.valueAsNumber })}
                />
              </label>
            </div>
            <label class="check">
              <Input
                type="checkbox"
                checked={variant.value.active}
                onChange$={(_, el) => (variant.value = { ...variant.value, active: el.checked })}
              />{' '}
              Active variant
            </label>
            {saveError}
            <ActionBar q:slot="actions" label="Editor actions">
              <Button class="secondary" onClick$={closeEditor} icon="close" label="Cancel" />
              <Button
                type="submit"
                disabled={busy}
                icon="save"
                label={busy ? 'Saving…' : variant.value.id ? 'Update variant' : 'Save variant'}
              />
            </ActionBar>
          </EditorForm>
        )}
      </Modal>

      {subpage.value === 'products' ? (
        <>
          {shown.length === 0 ? (
            <Panel class="empty stack">
              <p>
                {data.Products.length
                  ? 'No products match these filters.'
                  : 'Add a product to start your catalog.'}
              </p>
            </Panel>
          ) : (
            <div class="product-list-scroll-frame">
              <div class="product-grid">
                {shown.map((item) => {
                  const variants = variantsByProduct.get(item.id) ?? [];
                  const productStatus = item.active ? 'Active' : 'Archived';

                  return (
                    <article class="panel product-card" key={item.id}>
                      <Collapsible.Root class="product-disclosure">
                        <div class="product-head">
                          <div class="product-identity">
                            <ProductPhoto
                              key={`${item.name}:${item.image ?? ''}`}
                              name={item.name}
                              value={item.image}
                              class="catalog-photo"
                            />
                            <div class="product-heading">
                              <p class="eyebrow">{categoryNames.get(item.categoryId) || 'Uncategorized'}</p>
                              <h3>{item.name}</h3>
                              {item.description && <p class="muted">{item.description}</p>}
                            </div>
                          </div>
                          <div class="row product-actions">
                            <Badge status={productStatus}>{productStatus}</Badge>
                            <Collapsible.Trigger
                              class="button secondary compact variant-toggle"
                              aria-label={`Variants for ${item.name}`}
                            >
                              <span>
                                {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
                              </span>
                              <span class="control-chevron" aria-hidden="true" />
                            </Collapsible.Trigger>
                            <Button
                              class="secondary compact catalog-icon-button"
                              title="Edit product"
                              aria-label={`Edit product ${item.name}`}
                              onClick$={() => openProduct(item)}
                            >
                              <Icon name="edit" />
                            </Button>
                            <Button
                              class="secondary compact catalog-icon-button"
                              title="Add variant"
                              aria-label={`Add variant to ${item.name}`}
                              onClick$={() => openVariant(newVariant(item.id))}
                            >
                              <Icon name="plus" />
                            </Button>
                          </div>
                        </div>
                        <Collapsible.Content class="product-variants">
                          {variants.length > 0 ? (
                            <>
                              <Table desktopOnly aria-label={`Variants for ${item.name}`}>
                                <thead>
                                  <tr>
                                    <th scope="col">Variant</th>
                                    <th scope="col">SKU</th>
                                    <th scope="col" class="numeric">
                                      Price ({currency})
                                    </th>
                                    <th scope="col">Status</th>
                                    <th scope="col">
                                      <span class="sr-only">Action</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {variants.map((row) => {
                                    const variantStatus = row.active ? 'Active' : 'Archived';
                                    return (
                                      <tr key={row.id}>
                                        <td>
                                          <ProductLabel name={item.name} image={item.image}>
                                            {row.optionValues || 'Default'}
                                          </ProductLabel>
                                        </td>
                                        <td class="sku">{row.sku}</td>
                                        <td class="numeric">{decimalAmount(row.price, numberFormat)}</td>
                                        <td>
                                          <Badge status={variantStatus}>{variantStatus}</Badge>
                                        </td>
                                        <td>
                                          <Button
                                            class="secondary compact catalog-icon-button"
                                            title="Edit variant"
                                            aria-label={`Edit variant ${row.sku}`}
                                            onClick$={() => openVariant(row)}
                                          >
                                            <Icon name="edit" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </Table>
                              <ul class="mobile-records" aria-label={`Variants for ${item.name}`}>
                                {variants.map((row) => {
                                  const variantStatus = row.active ? 'Active' : 'Archived';
                                  return (
                                    <li class="mobile-record" key={row.id}>
                                      <div class="mobile-record-head">
                                        <ProductLabel name={item.name} image={item.image}>
                                          <strong>{row.optionValues || 'Default'}</strong>
                                          <span class="inventory-row-meta sku">{row.sku}</span>
                                        </ProductLabel>
                                        <Button
                                          class="secondary compact catalog-icon-button"
                                          title="Edit variant"
                                          aria-label={`Edit variant ${row.sku}`}
                                          onClick$={() => openVariant(row)}
                                        >
                                          <Icon name="edit" />
                                        </Button>
                                      </div>
                                      <dl class="mobile-record-values">
                                        <div>
                                          <dt>Price</dt>
                                          <dd>
                                            {decimalAmount(row.price, numberFormat)} {currency}
                                          </dd>
                                        </div>
                                        <div>
                                          <dt>Status</dt>
                                          <dd>
                                            <Badge status={variantStatus}>{variantStatus}</Badge>
                                          </dd>
                                        </div>
                                      </dl>
                                    </li>
                                  );
                                })}
                              </ul>
                            </>
                          ) : (
                            <p class="empty">No variants yet.</p>
                          )}
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div class="component-scroll stack category-list">
          {shownCategories.length ? (
            shownCategories.map((item) => (
              <Panel key={item.value} class="category-row">
                <div>
                  <h3>{item.label}</h3>
                  <p class="muted">
                    {data.Products.filter((row) => row.categoryId === item.value).length} products ·{' '}
                    {data.Categories.filter((row) => row.parentId === item.value).length} subcategories
                  </p>
                </div>
                <div class="row">
                  <Button
                    class="secondary compact"
                    aria-label={`Edit category ${item.label}`}
                    onClick$={() => openCategory(item.value)}
                    icon="edit"
                    mobileIconOnly
                    label="Edit"
                  />
                  <Button
                    class="secondary compact"
                    aria-label={`Add subcategory to ${item.label}`}
                    onClick$={() => openCategory('', item.value)}
                    icon="plus"
                    mobileIconOnly
                    label="Add subcategory"
                  />
                  <Button
                    class="secondary compact"
                    onClick$={async () => {
                      category.value = [item.value];
                      search.value = '';
                      status.value = [];
                      await navigate$('/catalog');
                    }}
                    icon="arrow-right"
                    mobileIconOnly
                    label="View products"
                  />
                </div>
              </Panel>
            ))
          ) : (
            <Panel class="empty">
              {data.Categories.length
                ? 'No categories match your search.'
                : 'Add a category to organize your products.'}
            </Panel>
          )}
        </div>
      )}
    </section>
  );
});
