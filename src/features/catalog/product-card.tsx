import { For } from 'solid-js';
import type { Product, Variant } from '../../domain/workbook';
import { decimalAmount } from '../../shared/lib/format';
import { SortableTable } from '../../shared/ui/sortable-table';
import { PagedRows } from '../../shared/ui/paged-rows';
import { Badge, Button } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { ProductLabel, ProductPhoto } from '../../shared/ui/product-thumbnail';
import { newVariant } from './catalog-options';

type ProductCardProps = {
  product: Product;
  expanded: boolean;
  onToggle: () => void;
  variants: Variant[];
  category?: string;
  currency: string;
  numberFormat: string;
  onEdit: (product: Product) => void;
  onEditVariant: (variant: Variant) => void;
};

export function ProductCard(props: ProductCardProps) {
  const status = () => (props.product.active ? 'Active' : 'Archived');
  return (
    <article class="panel product-card">
      <div class="product-disclosure">
        <div class="product-head">
          <div class="product-identity">
            <ProductPhoto name={props.product.name} value={props.product.image} class="catalog-photo" />
            <div class="product-heading">
              <p class="eyebrow">{props.category || 'Uncategorized'}</p>
              <h3>{props.product.name}</h3>
              {props.product.description && <p class="muted">{props.product.description}</p>}
            </div>
          </div>
          <div class="row product-actions">
            <Badge status={status()}>{status()}</Badge>
            <button
              type="button"
              aria-expanded={props.expanded ? 'true' : 'false'}
              onClick={props.onToggle}
              class="button secondary compact variant-toggle"
              aria-label={`Variants for ${props.product.name}`}
            >
              <span>
                {props.variants.length} {props.variants.length === 1 ? 'variant' : 'variants'}
              </span>
              <span class="control-chevron" aria-hidden="true" />
            </button>
            <Button
              class="secondary compact catalog-icon-button"
              title="Edit product"
              aria-label={`Edit product ${props.product.name}`}
              onClick={() => props.onEdit(props.product)}
            >
              <Icon name="edit" />
            </Button>
            <Button
              class="secondary compact catalog-icon-button"
              title="Add variant"
              aria-label={`Add variant to ${props.product.name}`}
              onClick={() => props.onEditVariant(newVariant(props.product.id))}
            >
              <Icon name="plus" />
            </Button>
          </div>
        </div>
        {props.expanded && (
          <div class="product-variants">
            {props.variants.length > 0 ? (
              <>
                <SortableTable
                  desktopOnly
                  aria-label={`Variants for ${props.product.name}`}
                  rows={props.variants}
                  estimate={56}
                  columns={[
                    { label: 'Variant', value: (r) => r.optionValues || 'Default' },
                    { label: 'SKU', value: (r) => r.sku },
                    { label: `Price (${props.currency})`, value: (r) => r.price, class: 'numeric' },
                    { label: 'Status', value: (r) => (r.active ? 'Active' : 'Archived') },
                    { label: 'Action' },
                  ]}
                >
                  {(page) => (
                    <For each={page()}>
                      {(row) => {
                        const variantStatus = row.active ? 'Active' : 'Archived';
                        return (
                          <tr>
                            <td>
                              <ProductLabel name={props.product.name} image={props.product.image}>
                                {row.optionValues || 'Default'}
                              </ProductLabel>
                            </td>
                            <td class="sku">{row.sku}</td>
                            <td class="numeric">{decimalAmount(row.price, props.numberFormat)}</td>
                            <td>
                              <Badge status={variantStatus}>{variantStatus}</Badge>
                            </td>
                            <td>
                              <Button
                                class="secondary compact catalog-icon-button"
                                title="Edit variant"
                                aria-label={`Edit variant ${row.sku}`}
                                onClick={() => props.onEditVariant(row)}
                              >
                                <Icon name="edit" />
                              </Button>
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  )}
                </SortableTable>
                <ul class="mobile-records paged-viewport" aria-label={`Variants for ${props.product.name}`}>
                  <PagedRows rows={props.variants} list estimate={100}>
                    {(page) => (
                      <For each={page()}>
                        {(row) => {
                          const variantStatus = row.active ? 'Active' : 'Archived';
                          return (
                            <li class="mobile-record">
                              <div class="mobile-record-head">
                                <ProductLabel name={props.product.name} image={props.product.image}>
                                  <strong>{row.optionValues || 'Default'}</strong>
                                  <span class="inventory-row-meta sku">{row.sku}</span>
                                </ProductLabel>
                                <Button
                                  class="secondary compact catalog-icon-button"
                                  title="Edit variant"
                                  aria-label={`Edit variant ${row.sku}`}
                                  onClick={() => props.onEditVariant(row)}
                                >
                                  <Icon name="edit" />
                                </Button>
                              </div>
                              <dl class="mobile-record-values">
                                <div>
                                  <dt>Price</dt>
                                  <dd>
                                    {decimalAmount(row.price, props.numberFormat)} {props.currency}
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
                        }}
                      </For>
                    )}
                  </PagedRows>
                </ul>
              </>
            ) : (
              <p class="empty">No variants yet.</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
