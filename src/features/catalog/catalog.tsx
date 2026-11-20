import { createMemo, createSignal, For, Show, useContext } from 'solid-js';

import { ScreenNavigation } from '../../app/navigation/screen-navigation';
import { workbookCurrency, workbookNumberFormat } from '../../domain/settings';
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
  Button,
  EditorForm,
  Input,
  Modal,
  MultiSelect,
  Panel,
  SelectField,
  Switch,
  Textarea,
} from '../../shared/ui/controls';
import { PagedRows } from '../../shared/ui/paged-rows';
import { Icon } from '../../shared/ui/icon';
import { ListFilters } from '../../shared/ui/list-filters';
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
import { ProductCard } from './product-card';
import { ProductImageInput } from './product-photo';

type CatalogProps = {
  data: WorkbookData;
  busy: boolean;
  error?: string;
  onCommit: (changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>;
};
export function Catalog(props: CatalogProps) {
  const { route, navigate } = useContext(ScreenNavigation);
  const subpage = () => route().catalogPage;
  const [categorySearch, setCategorySearch] = createSignal('');
  const [categoryParent, setCategoryParent] = createSignal('');
  const [search, setSearch] = createSignal('');
  const [category, setCategory] = createSignal<string[]>([]);
  const [status, setStatus] = createSignal<string[]>([]);
  const [editor, setEditor] = createSignal<'product' | 'variant' | 'category'>('product');
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [attemptedSave, setAttemptedSave] = createSignal(false);
  const [editBase, setEditBase] = createSignal<RowChange[]>([]);
  const [product, setProduct] = createSignal(newProduct(''));
  const [variant, setVariant] = createSignal(newVariant(''));
  const [categoryName, setCategoryName] = createSignal('');
  const [categoryId, setCategoryId] = createSignal('');
  const [firstSku, setFirstSku] = createSignal('');
  const [firstPrice, setFirstPrice] = createSignal(0);
  const [productOptions, setProductOptions] = createSignal<ProductOption[]>([]);
  const [variantOptions, setVariantOptions] = createSignal<VariantOption[]>([]);
  const [optionError, setOptionError] = createSignal('');
  const [productEditKey, setProductEditKey] = createSignal('');
  const [photoProcessing, setPhotoProcessing] = createSignal(false);

  const categoryNames = createMemo(
    () =>
      new Map(
        props.data.Categories.map(({ id }) => [
          id,
          categoryPath(props.data.Categories, id)
            .map((row) => row.name)
            .join(' / '),
        ]),
      ),
  );
  const categoryOptions = createMemo(() =>
    props.data.Categories.map(({ id }) => ({
      value: id,
      label: categoryNames().get(id)!,
    })).sort((a, b) => a.label.localeCompare(b.label)),
  );
  const shownCategories = createMemo(() =>
    categoryOptions().filter((row) =>
      row.label.toLowerCase().includes(categorySearch().trim().toLowerCase()),
    ),
  );
  const variantIndex = createMemo(() => {
    const variantsByProduct = new Map<string, Variant[]>();
    for (const item of props.data.Variants) {
      const variants = variantsByProduct.get(item.productId);
      if (variants) variants.push(item);
      else variantsByProduct.set(item.productId, [item]);
    }
    return variantsByProduct;
  });
  const query = createMemo(() => search().trim().toLowerCase());
  const hasFilters = createMemo(() => Boolean(query() || category().length || status().length));
  const [expandedIds, setExpandedIds] = createSignal<ReadonlySet<string>>(new Set());
  function toggleProduct(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const shown = createMemo(() =>
    props.data.Products.filter((item) => {
      if (
        category().length &&
        !categoryPath(props.data.Categories, item.categoryId).some((row) => category().includes(row.id))
      )
        return false;
      if (status().length && !status().includes(item.active ? 'active' : 'archived')) return false;
      const variantText = (variantIndex().get(item.id) ?? [])
        .map((row) => `${row.sku} ${row.optionValues}`)
        .join(' ');
      return !query() || `${item.name} ${variantText}`.toLowerCase().includes(query());
    }),
  );
  const currency = createMemo(() => workbookCurrency(props.data));
  const numberFormat = createMemo(() => workbookNumberFormat(props.data));
  const editorTitle = createMemo(() =>
    editor() === 'category'
      ? categoryId()
        ? 'Edit category'
        : 'New category'
      : editor() === 'variant'
        ? variant().id
          ? 'Edit variant'
          : 'New variant'
        : product().id
          ? 'Edit product'
          : 'New product',
  );

  const clearFilters = () => {
    setSearch('');
    setCategory([]);
    setStatus([]);
  };

  const openCategory = (id = '', parentId = '') => {
    const existing = props.data.Categories.find((row) => row.id === id);
    setEditBase(existing ? [{ tab: 'Categories', row: existing }] : []);
    setCategoryParent(existing?.parentId || parentId);
    setCategoryId(id);
    setCategoryName(existing?.name || '');
    setEditor('category');
    setAttemptedSave(false);
    setOptionError('');
    setEditorOpen(true);
  };

  const openProduct = (item?: Product) => {
    setEditBase(item ? [{ tab: 'Products', row: item }] : []);
    setProductEditKey(makeId());
    setPhotoProcessing(false);
    setProduct(item ? { ...item } : newProduct(category().length === 1 ? category()[0] : ''));
    const hasVariants = Boolean(item && props.data.Variants.some((row) => row.productId === item.id));
    setProductOptions(
      optionNamesOf(item?.optionNames ?? '').map((name) => ({
        id: makeId(),
        name,
        firstValue: '',
        saved: hasVariants,
      })),
    );
    setFirstSku('');
    setFirstPrice(0);
    setEditor('product');
    setAttemptedSave(false);
    setOptionError('');
    setEditorOpen(true);
  };

  const openVariant = (item: Variant) => {
    setEditBase(item.id ? [{ tab: 'Variants', row: item }] : []);
    setVariant({
      ...item,
      price: item.id
        ? item.price
        : (props.data.Variants.find((row) => row.productId === item.productId && row.active)?.price ??
          item.price),
    });
    const names = optionNamesOf(
      props.data.Products.find((row) => row.id === item.productId)?.optionNames ?? '',
    );
    setVariantOptions(readVariantOptions(names, item.optionValues));
    setEditor('variant');
    setAttemptedSave(false);
    setOptionError('');
    setEditorOpen(true);
  };

  const addOption = () => {
    setProductOptions([...productOptions(), { id: makeId(), name: '', firstValue: '', saved: false }]);
    setOptionError('');
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };
  const saveCategory = async () => {
    setAttemptedSave(true);
    if (
      await props.onCommit(
        [
          {
            tab: 'Categories',
            row: {
              id: categoryId() || makeId(),
              name: categoryName().trim(),
              parentId: categoryParent(),
            },
          },
        ],
        editBase(),
      )
    ) {
      setEditorOpen(false);
    }
  };

  const saveProduct = async () => {
    if (photoProcessing()) return;
    setAttemptedSave(false);
    setOptionError('');
    const names = productOptions().map(({ name }) => name.trim());
    const namesChanged =
      names.join(optionSeparator) !== optionNamesOf(product().optionNames).join(optionSeparator);
    if (namesChanged && names.some((name) => !name || name.includes('/'))) {
      setOptionError('Enter one option name per field, such as Color or Size.');
      return;
    }
    if (namesChanged && new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) {
      setOptionError('Give each option a different name.');
      return;
    }
    const firstValues = productOptions().map(({ firstValue }) => firstValue.trim());
    if (!product().id) {
      setOptionError(validateOptionValues(firstValues));
      if (optionError()) return;
    }
    setAttemptedSave(true);
    const id = product().id || makeId();
    const changes: RowChange[] = [
      {
        tab: 'Products',
        row: {
          ...product(),
          id,
          name: product().name.trim(),
          optionNames: namesChanged ? names.join(optionSeparator) : product().optionNames,
        },
      },
    ];
    if (!product().id) {
      changes.push({
        tab: 'Variants',
        row: {
          ...newVariant(id),
          id: makeId(),
          sku: firstSku().trim(),
          price: firstPrice(),
          optionValues: firstValues.join(optionSeparator),
        },
      });
    }
    if (await props.onCommit(changes, editBase())) setEditorOpen(false);
  };

  const saveVariant = async () => {
    setAttemptedSave(false);
    setOptionError('');
    const updateValues =
      !variant().id || variantOptions().some((option) => option.value.trim() !== option.originalValue);
    const values = variantOptions().map((option) => option.value.trim());
    if (updateValues && values.length) {
      setOptionError(validateOptionValues(values));
      if (optionError()) return;
    }
    setAttemptedSave(true);
    const row = {
      ...variant(),
      id: variant().id || makeId(),
      sku: variant().sku.trim(),
      optionValues: updateValues && values.length ? values.join(optionSeparator) : variant().optionValues,
    };
    if (await props.onCommit([{ tab: 'Variants', row }], editBase())) setEditorOpen(false);
  };

  const editorError = createMemo(() => optionError() || (attemptedSave() ? props.error : ''));
  const saveError = createMemo(() =>
    editorError() ? (
      <p class="notice error" role="alert">
        {editorError()}
      </p>
    ) : null,
  );

  return (
    <section class="stack catalog-page">
      <h1 class="sr-only">Catalog</h1>
      <div class="catalog-toolbar">
        <nav class="row catalog-tabs" aria-label="Catalog pages">
          <Button
            class={subpage() === 'products' ? '' : 'secondary'}
            aria-current={subpage() === 'products' ? 'page' : undefined}
            onClick={() => navigate('/catalog')}
          >
            Products
          </Button>
          <Button
            class={subpage() === 'categories' ? '' : 'secondary'}
            aria-current={subpage() === 'categories' ? 'page' : undefined}
            onClick={() => navigate('/catalog/categories')}
          >
            Categories
          </Button>
        </nav>
        {subpage() === 'products' ? (
          <>
            <ListFilters
              title="Filter products"
              count={category().length + status().length + Number(Boolean(query()))}
              class="catalog-filters"
            >
              <label class="field catalog-search input-with-icon">
                <span class="sr-only">Search products</span>
                <Icon name="search" />
                <Input
                  controlSize="sm"
                  type="search"
                  placeholder="Name or SKU"
                  value={search()}
                  onInput={(event) => {
                    setSearch(event.currentTarget.value);
                  }}
                />
              </label>
              <MultiSelect
                controlSize="sm"
                label="Category"
                placeholder="All categories"
                value={category()}
                options={categoryOptions()}
                onChange={(value) => {
                  setCategory(value);
                }}
              />
              <MultiSelect
                controlSize="sm"
                placeholder="All statuses"
                label="Product status"
                value={status()}
                options={statusOptions}
                onChange={(value) => {
                  setStatus(value);
                }}
              />
              {hasFilters() && (
                <Button
                  class="secondary catalog-icon-button"
                  title="Clear filters"
                  aria-label="Clear filters"
                  onClick={clearFilters}
                >
                  <Icon name="close" />
                </Button>
              )}
            </ListFilters>
            <p class="sr-only" aria-live="polite">
              {shown().length} of {props.data.Products.length} products
            </p>
          </>
        ) : (
          <ListFilters
            title="Filter categories"
            count={Number(Boolean(categorySearch().trim()))}
            class="catalog-filters"
          >
            <label class="field catalog-search input-with-icon">
              <span class="sr-only">Search categories</span>
              <Icon name="search" />
              <Input
                controlSize="sm"
                placeholder="Search categories"
                type="search"
                value={categorySearch()}
                onInput={(event) => {
                  setCategorySearch(event.currentTarget.value);
                }}
              />
            </label>
          </ListFilters>
        )}
      </div>
      {!editorOpen() && (
        <ActionBar class="record-shortcut" label="Catalog actions">
          {subpage() === 'categories' ? (
            <Button onClick={() => openCategory()} icon="category-add" label="Add category" />
          ) : (
            <Button onClick={() => openProduct()} icon="product-add" label="Add product" />
          )}
        </ActionBar>
      )}

      <Modal
        open={editorOpen()}
        onDismiss={() => setEditorOpen(false)}
        title={editorTitle()}
        notice={editorOpen() && <ReconnectNotice />}
      >
        {editor() === 'category' && (
          <EditorForm
            class="stack"
            onSubmit={saveCategory}
            actions={
              <ActionBar label="Editor actions">
                <Button class="secondary" onClick={closeEditor} icon="close" label="Cancel" />
                <Button
                  type="submit"
                  disabled={props.busy}
                  icon="save"
                  label={props.busy ? 'Saving…' : categoryId() ? 'Update category' : 'Save category'}
                />
              </ActionBar>
            }
          >
            <label class="field">
              Category name
              <Input
                required
                value={categoryName()}
                onInput={(event) => {
                  setCategoryName(event.currentTarget.value);
                }}
              />
            </label>
            <SelectField
              label="Parent category"
              value={categoryParent()}
              onChange={(value) => {
                setCategoryParent(value);
              }}
              options={[
                { value: '', label: 'None (top-level category)' },
                ...categoryOptions().filter(
                  (row) =>
                    !categoryPath(props.data.Categories, row.value).some(
                      (ancestor) => ancestor.id === categoryId(),
                    ),
                ),
              ]}
            />
            {saveError()}
          </EditorForm>
        )}

        {editor() === 'product' && (
          <EditorForm
            class="stack product-editor"
            onSubmit={saveProduct}
            actions={
              <ActionBar label="Editor actions">
                <Button class="secondary" onClick={closeEditor} icon="close" label="Cancel" />
                <Button
                  type="submit"
                  disabled={props.busy || photoProcessing()}
                  icon="save"
                  label={props.busy ? 'Saving…' : product().id ? 'Update product' : 'Save product'}
                />
              </ActionBar>
            }
          >
            <div class="form-grid">
              <label class="field">
                Product name
                <Input
                  required
                  value={product().name}
                  onInput={(event) => {
                    const el = event.currentTarget;
                    return setProduct({ ...product(), name: el.value });
                  }}
                />
              </label>
              <SelectField
                label="Category"
                value={product().categoryId}
                onChange={(value) => {
                  setProduct({ ...product(), categoryId: value });
                }}
                options={[{ value: '', label: 'Uncategorized' }, ...categoryOptions()]}
              />
            </div>
            <label class="field">
              Description
              <Textarea
                value={product().description}
                onInput={(event) => {
                  const el = event.currentTarget;
                  return setProduct({ ...product(), description: el.value });
                }}
              />
            </label>
            <Show when={productEditKey()} keyed>
              {(_editorKey) => (
                <ProductImageInput
                  value={product().image}
                  editorVersion={productEditKey()}
                  processing={photoProcessing()}
                  onProcessingChange={setPhotoProcessing}
                  disabled={props.busy}
                  onChange={(image) => {
                    setProduct({ ...product(), image });
                  }}
                />
              )}
            </Show>
            {productOptions().length > 0 ? (
              <fieldset class="option-fields stack">
                <legend>Options</legend>
                <For each={productOptions()} keyed={(row) => row.id}>
                  {(option, index) => (
                    <div class="option-name-row">
                      <label class="field">
                        Option name {index() + 1}
                        <Input
                          required
                          value={option().name}
                          placeholder={index() === 0 ? 'e.g. Color' : 'e.g. Size'}
                          onInput={(event) => {
                            const el = event.currentTarget;
                            setProductOptions(
                              productOptions().map((row) =>
                                row.id === option().id ? { ...row, name: el.value } : row,
                              ),
                            );
                            setOptionError('');
                          }}
                        />
                      </label>
                      {!option().saved && (
                        <Button
                          class="secondary"
                          aria-label={`Remove option ${index() + 1}`}
                          onClick={() => {
                            setProductOptions(productOptions().filter((row) => row.id !== option().id));
                            setOptionError('');
                          }}
                          icon="close"
                          label="Remove"
                        />
                      )}
                    </div>
                  )}
                </For>
                <Button
                  class="secondary option-add"
                  onClick={addOption}
                  icon="plus"
                  label="Add another option"
                />
              </fieldset>
            ) : (
              <Button class="secondary option-add" onClick={addOption} icon="plus" label="Add options" />
            )}
            {!product().id && (
              <section class="stack" aria-labelledby="first-variant-title">
                <h3 id="first-variant-title">
                  {productOptions().length ? 'First variant' : 'SKU and price'}
                </h3>
                <div class="form-grid">
                  <label class="field">
                    SKU
                    <Input
                      required
                      value={firstSku()}
                      onInput={(event) => {
                        setFirstSku(event.currentTarget.value);
                      }}
                    />
                  </label>
                  <label class="field">
                    Price ({currency()})
                    <Input
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.01"
                      required
                      value={Number.isNaN(firstPrice()) ? '' : firstPrice()}
                      onInput={(event) => {
                        setFirstPrice(event.currentTarget.valueAsNumber);
                      }}
                    />
                  </label>
                  <For each={productOptions().filter((option) => option.name.trim())} keyed={(row) => row.id}>
                    {(option) => (
                      <label class="field">
                        {option().name.trim()}
                        <Input
                          required
                          value={option().firstValue}
                          onInput={(event) => {
                            const el = event.currentTarget;
                            setProductOptions(
                              productOptions().map((row) =>
                                row.id === option().id ? { ...row, firstValue: el.value } : row,
                              ),
                            );
                            setOptionError('');
                          }}
                        />
                      </label>
                    )}
                  </For>
                </div>
              </section>
            )}
            <Switch
              label="Active product"
              checked={product().active}
              onChange={(event) => {
                const input = event.currentTarget;
                setProduct({ ...product(), active: input.checked });
              }}
            />
            {saveError()}
          </EditorForm>
        )}

        {editor() === 'variant' && (
          <EditorForm
            class="stack"
            onSubmit={saveVariant}
            actions={
              <ActionBar label="Editor actions">
                <Button class="secondary" onClick={closeEditor} icon="close" label="Cancel" />
                <Button
                  type="submit"
                  disabled={props.busy}
                  icon="save"
                  label={props.busy ? 'Saving…' : variant().id ? 'Update variant' : 'Save variant'}
                />
              </ActionBar>
            }
          >
            <p class="muted">{props.data.Products.find(({ id }) => id === variant().productId)?.name}</p>
            <div class="form-grid">
              <label class="field">
                SKU
                <Input
                  required
                  value={variant().sku}
                  onInput={(event) => {
                    const el = event.currentTarget;
                    return setVariant({ ...variant(), sku: el.value });
                  }}
                />
              </label>
              <For each={variantOptions()} keyed={(row) => row.name}>
                {(option, index) => (
                  <label class="field">
                    {option().name}
                    <Input
                      required={!variant().id}
                      value={option().value}
                      onInput={(event) => {
                        const el = event.currentTarget;
                        setVariantOptions(
                          variantOptions().map((row, position) =>
                            position === index() ? { ...row, value: el.value } : row,
                          ),
                        );
                        setOptionError('');
                      }}
                    />
                  </label>
                )}
              </For>
              {variantOptions().length === 0 && variant().optionValues && (
                <label class="field">
                  Variant label
                  <Input
                    value={variant().optionValues}
                    onInput={(event) => {
                      const el = event.currentTarget;
                      return setVariant({ ...variant(), optionValues: el.value });
                    }}
                  />
                </label>
              )}
              <label class="field">
                Price ({currency()})
                <Input
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.01"
                  required
                  value={Number.isNaN(variant().price) ? '' : variant().price}
                  onInput={(event) => {
                    const el = event.currentTarget;
                    return setVariant({ ...variant(), price: el.valueAsNumber });
                  }}
                />
              </label>
            </div>
            <Switch
              label="Active variant"
              checked={variant().active}
              onChange={(event) => {
                const input = event.currentTarget;
                setVariant({ ...variant(), active: input.checked });
              }}
            />
            {saveError()}
          </EditorForm>
        )}
      </Modal>

      {subpage() === 'products' ? (
        <>
          {shown().length === 0 ? (
            <Panel class="empty stack">
              <p>
                {props.data.Products.length
                  ? 'No products match these filters.'
                  : 'Add a product to start your catalog.'}
              </p>
            </Panel>
          ) : (
            <div class="product-list-scroll-frame">
              <div class="product-grid paged-viewport">
                <PagedRows
                  rows={shown()}
                  estimate={120}
                  resetKey={JSON.stringify([search(), category(), status()])}
                >
                  {(page) => (
                    <For each={page()} keyed={(product) => product.id}>
                      {(product) => (
                        <ProductCard
                          expanded={expandedIds().has(product().id)}
                          onToggle={() => toggleProduct(product().id)}
                          product={product()}
                          variants={variantIndex().get(product().id) ?? []}
                          category={categoryNames().get(product().categoryId)}
                          currency={currency()}
                          numberFormat={numberFormat()}
                          onEdit={openProduct}
                          onEditVariant={openVariant}
                        />
                      )}
                    </For>
                  )}
                </PagedRows>
              </div>
            </div>
          )}
        </>
      ) : (
        <div class="component-scroll stack category-list paged-viewport">
          {shownCategories().length ? (
            <PagedRows rows={shownCategories()} estimate={90} resetKey={categorySearch()}>
              {(page) => (
                <>
                  {page().map((item) => (
                    <Panel class="category-row">
                      <div>
                        <h3>{item.label}</h3>
                        <p class="muted">
                          {props.data.Products.filter((row) => row.categoryId === item.value).length} products
                          · {props.data.Categories.filter((row) => row.parentId === item.value).length}{' '}
                          subcategories
                        </p>
                      </div>
                      <div class="row">
                        <Button
                          class="secondary compact"
                          aria-label={`Edit category ${item.label}`}
                          onClick={() => openCategory(item.value)}
                          icon="edit"
                          mobileIconOnly
                          label="Edit"
                        />
                        <Button
                          class="secondary compact"
                          aria-label={`Add subcategory to ${item.label}`}
                          onClick={() => openCategory('', item.value)}
                          icon="plus"
                          mobileIconOnly
                          label="Add subcategory"
                        />
                        <Button
                          class="secondary compact"
                          onClick={async () => {
                            setCategory([item.value]);
                            setSearch('');
                            setStatus([]);
                            await navigate('/catalog');
                          }}
                          icon="arrow-right"
                          mobileIconOnly
                          label="View products"
                        />
                      </div>
                    </Panel>
                  ))}
                </>
              )}
            </PagedRows>
          ) : (
            <Panel class="empty">
              {props.data.Categories.length
                ? 'No categories match your search.'
                : 'Add a category to organize your products.'}
            </Panel>
          )}
        </div>
      )}
    </section>
  );
}
