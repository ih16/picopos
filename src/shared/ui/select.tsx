import { component$, useSignal, useTask$, type QRL } from '@builder.io/qwik';
import { Combobox } from '@qwik-ui/headless';
import { ProductPhoto } from './product-thumbnail';

type ControlSizeProps = { controlSize?: 'sm' | 'md' };

type SelectOptions = {
  value: string;
  label: string;
  disabled?: boolean;
  image?: string;
  imageName?: string;
}[];
type SelectFieldProps = ControlSizeProps & {
  label: string;
  value: string;
  options: SelectOptions;
  onChange$: QRL<(value: string) => void | boolean | Promise<void | boolean>>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  describedBy?: string;
  class?: string;
};
type MultiSelectProps = Omit<SelectFieldProps, 'value' | 'onChange$'> & {
  value: string[];
  onChange$: QRL<(value: string[]) => void | Promise<void>>;
};

const emptyOption = '__picopos_empty_filter__';

const SearchableSelect = component$<
  Omit<SelectFieldProps, 'value' | 'onChange$'> & {
    value: string[];
    multiple: boolean;
    onChange$: QRL<(value: string[]) => void | boolean | Promise<void | boolean>>;
  }
>((props) => {
  const selected = useSignal<string | string[]>(props.multiple ? props.value : props.value[0] || '');
  const control = useSignal<HTMLElement>();
  const panel = useSignal<HTMLElement>();
  const open = useSignal(false);
  useTask$(({ track }) => {
    const value = track(() => props.value);
    selected.value = props.multiple ? [...value] : value[0] || '';
  });
  // Observe the binding because Qwik UI 0.7 does not emit onChange for an empty selection.
  useTask$(async ({ track }) => {
    const current = track(() => selected.value);
    const value = Array.isArray(current) ? current : current ? [current] : [];
    // Clearing search text must not save an empty status or other single-value field.
    if (!props.multiple && value.length === 0) return;
    if (JSON.stringify(value) !== JSON.stringify(props.value)) {
      if ((await props.onChange$(value)) === false)
        selected.value = props.multiple ? [...props.value] : props.value[0] || '';
    }
  });
  useTask$(({ track, cleanup }) => {
    const isOpen = track(() => open.value);
    const anchor = track(() => control.value);
    const popover = track(() => panel.value);
    if (!isOpen || !anchor || !popover) return;
    const resize = () => {
      popover.style.width = `${anchor.getBoundingClientRect().width}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(anchor);
    cleanup(() => observer.disconnect());
  });
  useTask$(({ track, cleanup }) => {
    const popover = track(() => panel.value);
    if (!popover) return;
    const holdExitAnchor = (event: Event) => {
      if ((event as ToggleEvent).newState === 'open') {
        delete popover.dataset.exitAnchor;
        return;
      }
      // Keep the top-layer coordinates while Floating UI recomputes on close.
      const rect = popover.getBoundingClientRect();
      const translateY = parseFloat(getComputedStyle(popover).translate.split(' ')[1] || '0') || 0;
      popover.style.setProperty('--select-exit-left', `${rect.left}px`);
      popover.style.setProperty('--select-exit-top', `${rect.top - translateY}px`);
      popover.style.setProperty('--select-exit-width', `${rect.width}px`);
      popover.dataset.exitAnchor = '';
    };
    popover.addEventListener('beforetoggle', holdExitAnchor);
    cleanup(() => popover.removeEventListener('beforetoggle', holdExitAnchor));
  });
  const selectedOption = !props.multiple
    ? props.options.find((option) => option.value === props.value[0])
    : undefined;
  const selectedCount = props.multiple && Array.isArray(selected.value) ? selected.value.length : 0;
  return (
    <Combobox.Root
      class={['field ui-select ui-combobox', props.class]}
      data-control-size={props.controlSize ?? 'md'}
      multiple={props.multiple}
      filter
      bind:value={selected}
      bind:open={open}
      disabled={props.disabled}
      required={props.required}
      name={props.name}
    >
      <Combobox.HiddenNativeSelect />
      <Combobox.Label>{props.label}</Combobox.Label>
      <Combobox.Control
        ref={control}
        class={[
          'ui-combobox-control',
          selectedCount > 0 && 'has-selection-count',
          selectedOption?.imageName && 'has-product-photo',
        ]}
      >
        {selectedOption?.imageName && (
          <ProductPhoto
            value={selectedOption.image}
            name={selectedOption.imageName}
            class="select-product-photo"
          />
        )}
        <Combobox.Input
          placeholder={selectedCount > 0 ? props.label : props.placeholder || 'Search options'}
          autocomplete="off"
          aria-describedby={props.describedBy}
          onClick$={() => {
            if (!props.disabled) open.value = true;
          }}
          onBlur$={() => {
            if (!props.multiple && selected.value === '') selected.value = props.value[0] || '';
          }}
        />
        <Combobox.Trigger
          type="button"
          class="ui-combobox-trigger"
          aria-label={`Show ${props.label.toLowerCase()} options${selectedCount > 0 ? `, ${selectedCount} selected` : ''}`}
        >
          {selectedCount > 0 && (
            <span class="badge ui-select-count" aria-hidden="true">
              {selectedCount}
            </span>
          )}
          <span class="control-chevron" aria-hidden="true" />
        </Combobox.Trigger>
      </Combobox.Control>
      <Combobox.Popover ref={panel} floating="bottom-start" flip gutter={4} class="ui-select-popover">
        <Combobox.Empty class="ui-combobox-empty">No matching options.</Combobox.Empty>
        {props.options.map((option) => (
          <Combobox.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            class="ui-select-item"
          >
            {option.imageName && (
              <ProductPhoto value={option.image} name={option.imageName} class="product-list-photo" />
            )}
            <Combobox.ItemLabel>{option.label}</Combobox.ItemLabel>
            <Combobox.ItemIndicator class="ui-select-indicator">✓</Combobox.ItemIndicator>
          </Combobox.Item>
        ))}
      </Combobox.Popover>
    </Combobox.Root>
  );
});

export const SelectField = component$<SelectFieldProps>((props) => (
  <SearchableSelect
    {...props}
    multiple={false}
    value={
      props.value ? [props.value] : props.options.some((option) => option.value === '') ? [emptyOption] : []
    }
    options={props.options.map((option) => ({ ...option, value: option.value || emptyOption }))}
    onChange$={(values) => props.onChange$(values[0] === emptyOption ? '' : values[0] || '')}
  />
));
export const MultiSelect = component$<MultiSelectProps>((props) => <SearchableSelect {...props} multiple />);
