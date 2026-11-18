import { component$, Slot, useComputed$ } from '@builder.io/qwik';
import { MAX_PRODUCT_IMAGE_LENGTH } from '../../domain/workbook';

export function photoSource(value?: string): string | undefined {
  return value &&
    value.length <= MAX_PRODUCT_IMAGE_LENGTH &&
    /^data:image\/(?:jpeg|webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : undefined;
}

export const ProductPhoto = component$<{ value?: string; name: string; class?: string }>((props) => {
  const src = useComputed$(() => photoSource(props.value));
  return src.value ? (
    <img
      class={['product-photo', props.class]}
      src={src.value}
      alt={props.name}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span class={['product-photo', 'product-photo-placeholder', props.class]} aria-hidden="true">
      {Array.from(props.name.trim())[0]?.toUpperCase() || 'P'}
    </span>
  );
});

export const ProductLabel = component$<{ image?: string; name: string }>((props) => (
  <span class="product-label">
    <ProductPhoto value={props.image} name={props.name} class="product-list-photo" />
    <span class="product-label-text">
      <Slot />
    </span>
  </span>
));
