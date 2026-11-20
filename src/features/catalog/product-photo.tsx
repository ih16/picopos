import { createMemo, createSignal } from 'solid-js';

import { Button, Input } from '../../shared/ui/controls';
import { ProductPhoto, photoSource } from '../../shared/ui/product-thumbnail';
import { makeThumbnail, photoTypes } from './product-image';

type ProductImageInputProps = {
  value?: string;
  disabled?: boolean;
  processing: boolean;
  onProcessingChange: (active: boolean) => void;
  editorVersion: string;
  onChange: (value: string) => void | Promise<void>;
};

export function ProductImageInput(props: ProductImageInputProps) {
  const [error, setError] = createSignal('');
  const photo = createMemo(() => photoSource(props.value));

  return (
    <div class="product-image-input stack">
      <label class="field">
        Product picture <span class="muted">Optional</span>
        <Input
          type="file"
          class="product-photo-file"
          accept={photoTypes.join(',')}
          disabled={props.disabled || props.processing}
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            const version = props.editorVersion;
            const isCurrent = () => input.isConnected && props.editorVersion === version;
            setError('');
            props.onProcessingChange(true);
            try {
              const thumbnail = await makeThumbnail(file);
              if (isCurrent()) await props.onChange(thumbnail);
            } catch (cause) {
              if (isCurrent())
                setError(cause instanceof Error ? cause.message : 'Could not prepare this photo.');
            } finally {
              if (isCurrent()) props.onProcessingChange(false);
            }
          }}
        />
      </label>
      {!!props.value && (
        <div class="product-image-actions row">
          {photo() && (
            <ProductPhoto value={photo()} name="Product picture preview" class="product-photo-preview" />
          )}
          <Button
            class="secondary compact"
            disabled={props.disabled || props.processing}
            onClick={async () => {
              setError('');
              await props.onChange('');
            }}
            icon="close"
            label="Remove picture"
          />
        </div>
      )}
      {props.processing && (
        <p class="muted" role="status">
          Preparing picture…
        </p>
      )}
      {error() && (
        <p class="notice error" role="alert">
          {error()}
        </p>
      )}
    </div>
  );
}
