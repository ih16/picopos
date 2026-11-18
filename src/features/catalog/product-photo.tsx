import { component$, useComputed$, useSignal, type QRL, type Signal } from '@builder.io/qwik';
import { Button, Input } from '../../shared/ui/controls';
import { ProductPhoto, photoSource } from '../../shared/ui/product-thumbnail';
import { makeThumbnail, photoTypes } from './product-image';

export const ProductImageInput = component$<{
  value?: string;
  disabled?: boolean;
  processing?: Signal<boolean>;
  editorVersion?: Readonly<Signal<number | string>>;
  onChange$: QRL<(value: string) => void | Promise<void>>;
}>((props) => {
  const ownProcessing = useSignal(false);
  const processing = props.processing ?? ownProcessing;
  const error = useSignal('');
  const photo = useComputed$(() => photoSource(props.value));

  return (
    <div class="product-image-input stack">
      <label class="field">
        Product picture <span class="muted">Optional</span>
        <Input
          type="file"
          class="product-photo-file"
          accept={photoTypes.join(',')}
          disabled={props.disabled || processing.value}
          onChange$={async (_, input) => {
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            const version = props.editorVersion?.value;
            const isCurrent = () => input.isConnected && props.editorVersion?.value === version;
            error.value = '';
            processing.value = true;
            try {
              const thumbnail = await makeThumbnail(file);
              if (isCurrent()) await props.onChange$(thumbnail);
            } catch (cause) {
              if (isCurrent())
                error.value = cause instanceof Error ? cause.message : 'Could not prepare this photo.';
            } finally {
              if (isCurrent()) processing.value = false;
            }
          }}
        />
      </label>
      {!!props.value && (
        <div class="product-image-actions row">
          {photo.value && (
            <ProductPhoto
              key={photo.value}
              value={photo.value}
              name="Product picture preview"
              class="product-photo-preview"
            />
          )}
          <Button
            class="secondary compact"
            disabled={props.disabled || processing.value}
            onClick$={async () => {
              error.value = '';
              await props.onChange$('');
            }}
          >
            Remove picture
          </Button>
        </div>
      )}
      {processing.value && (
        <p class="muted" role="status">
          Preparing picture…
        </p>
      )}
      {error.value && (
        <p class="notice error" role="alert">
          {error.value}
        </p>
      )}
    </div>
  );
});
