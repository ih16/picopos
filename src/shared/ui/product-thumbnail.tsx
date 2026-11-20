import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';

import { MAX_PRODUCT_IMAGE_LENGTH } from '../../domain/workbook';

export function photoSource(value?: string): string | undefined {
  return value &&
    value.length <= MAX_PRODUCT_IMAGE_LENGTH &&
    /^data:image\/(?:jpeg|webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : undefined;
}

type ProductPhotoProps = { value?: string; name: string; class?: string };

export function ProductPhoto(props: ProductPhotoProps) {
  const src = createMemo(() => photoSource(props.value));
  return (
    <>
      {src() ? (
        <img
          class={['product-photo', props.class]}
          src={src()}
          alt={props.name}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span class={['product-photo', 'product-photo-placeholder', props.class]} aria-hidden="true">
          {Array.from(props.name.trim())[0]?.toUpperCase() || 'P'}
        </span>
      )}
    </>
  );
}

type ProductLabelProps = { image?: string; name: string } & { children?: JSX.Element };

export function ProductLabel(props: ProductLabelProps) {
  return (
    <span class="product-label">
      <ProductPhoto value={props.image} name={props.name} class="product-list-photo" />
      <span class="product-label-text">{props.children}</span>
    </span>
  );
}
