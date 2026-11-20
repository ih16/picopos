import { createVirtualList } from '@solid-primitives/virtual';
import { createEffect, createMemo, createSignal } from 'solid-js';

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
  onChange: (value: string) => void | boolean | Promise<void | boolean>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  describedBy?: string;
  class?: string;
};
type MultiSelectProps = Omit<SelectFieldProps, 'value' | 'onChange'> & {
  value: string[];
  onChange: (value: string[]) => void | Promise<void>;
};

type SearchProps = Omit<MultiSelectProps, 'onChange'> & {
  multiple?: boolean;
  onChange: (values: string[]) => unknown;
};
function SearchableSelect(props: SearchProps) {
  const id = crypto.randomUUID();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [active, setActive] = createSignal(-1);
  const choices = createMemo(() =>
    props.options.filter((option) => option.label.toLowerCase().includes(query().toLowerCase())),
  );
  const optionHeight = 52;
  const [optionWindow, onOptionsScroll] = createVirtualList({
    items: choices,
    rootHeight: 320,
    rowHeight: optionHeight,
    overscanCount: 2,
  });
  const windowedOptions = createMemo(optionWindow);
  const selectedValues = createMemo(() => new Set(props.value));
  const selected = createMemo(() => props.options.find((option) => selectedValues().has(option.value)));
  let input!: HTMLInputElement, panel!: HTMLDivElement, anchor!: HTMLDivElement;
  createEffect(
    () => props.required && !props.value.some(Boolean),
    (missing) => {
      input.setCustomValidity(missing ? 'Select an option.' : '');
    },
  );
  function show() {
    if (!props.disabled) {
      panel.showPopover();
      setOpen(true);
    }
  }
  function hide() {
    panel.hidePopover();
    setOpen(false);
    setQuery('');
    setActive(-1);
  }
  function choose(option: SelectOptions[number]) {
    if (option.disabled) return;
    void props.onChange(
      props.multiple
        ? selectedValues().has(option.value)
          ? props.value.filter((value) => value !== option.value)
          : [...props.value, option.value]
        : [option.value],
    );
    setQuery('');
    if (!props.multiple) hide();
  }
  createEffect(open, (visible) => {
    if (!visible) return;
    function position() {
      const rect = anchor.getBoundingClientRect();
      panel.style.width = rect.width + 'px';
      panel.style.left = rect.left + 'px';
      const below = window.innerHeight - rect.bottom;
      panel.style.top =
        (below < panel.offsetHeight && rect.top > below
          ? Math.max(0, rect.top - panel.offsetHeight - 4)
          : rect.bottom + 4) + 'px';
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(panel);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  });
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape' && open()) {
      event.preventDefault();
      event.stopPropagation();
      hide();
      return;
    }
    if (event.key === 'Enter' && open()) {
      event.preventDefault();
      const option = choices()[active()];
      if (option) choose(option);
      return;
    }
    if (event.key === 'Tab') {
      if (open()) hide();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    show();
    const options = choices();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    let i = active() < 0 && step < 0 ? 0 : active();
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) {
        setActive(i);
        const top = i * optionHeight;
        if (top < panel.scrollTop) panel.scrollTop = top;
        else if (top + optionHeight > panel.scrollTop + panel.clientHeight - 10)
          panel.scrollTop = top + optionHeight - panel.clientHeight + 10;
        break;
      }
    }
  }
  return (
    <div class={['field ui-select ui-combobox', props.class]} data-control-size={props.controlSize ?? 'md'}>
      <label for={id}>{props.label}</label>
      <div
        ref={anchor}
        class={[
          'ui-combobox-control',
          props.multiple && props.value.length > 0 && 'has-selection-count',
          !props.multiple && selected()?.imageName && 'has-product-photo',
        ]}
      >
        {!props.multiple && selected()?.imageName && (
          <ProductPhoto
            name={selected()!.imageName!}
            value={selected()?.image}
            class="select-product-photo"
          />
        )}
        {props.name &&
          props.value.map((value) => (
            <input type="hidden" name={props.name} value={value} disabled={props.disabled} />
          ))}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={id + '-options'}
          aria-expanded={open() ? 'true' : 'false'}
          aria-activedescendant={open() && active() >= 0 ? id + '-' + active() : undefined}
          aria-describedby={props.describedBy}
          disabled={props.disabled}
          required={props.required && !props.value.length}
          autocomplete="off"
          placeholder={props.placeholder || 'Search options'}
          value={open() ? query() : props.multiple ? '' : (selected()?.label ?? '')}
          onClick={show}
          onInput={(event) => {
            panel.scrollTop = 0;
            setQuery(event.currentTarget.value);
            setActive(-1);
            show();
          }}
          onKeyDown={key}
        />
        <button
          type="button"
          class="ui-combobox-trigger"
          aria-label={'Show ' + props.label.toLowerCase() + ' options'}
          aria-expanded={open() ? 'true' : 'false'}
          disabled={props.disabled}
          onClick={() => {
            input.focus();
            if (open()) hide();
            else show();
          }}
        >
          {props.multiple && props.value.length > 0 && (
            <span class="badge ui-select-count">{props.value.length}</span>
          )}
          <span class="control-chevron" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={panel}
        onScroll={onOptionsScroll}
        role="listbox"
        aria-label={props.label}
        aria-multiselectable={props.multiple ? 'true' : 'false'}
        id={id + '-options'}
        popover="auto"
        class="ui-select-popover"
        style="position:fixed;inset:auto;margin:0"
        onToggle={(event) => {
          if (event.newState === 'closed') {
            setOpen(false);
            setQuery('');
            setActive(-1);
          }
        }}
      >
        {open() && !choices().length && <div class="ui-combobox-empty">No matching options.</div>}
        {open() && (
          <>
            <div aria-hidden="true" style={{ height: windowedOptions().viewerTop + 'px' }} />
            {windowedOptions().visibleItems.map((option, offset) => {
              const index = windowedOptions().firstIndex + offset;
              return (
                <div
                  id={id + '-' + index}
                  role="option"
                  title={option.label}
                  aria-setsize={choices().length}
                  aria-posinset={index + 1}
                  style={{ height: optionHeight + 'px' }}
                  aria-selected={selectedValues().has(option.value) ? 'true' : 'false'}
                  aria-disabled={option.disabled ? 'true' : 'false'}
                  data-highlighted={active() === index ? '' : undefined}
                  data-selected={selectedValues().has(option.value) ? '' : undefined}
                  data-disabled={option.disabled ? '' : undefined}
                  class="ui-select-item"
                  onPointerEnter={() => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {option.imageName && (
                    <ProductPhoto name={option.imageName} value={option.image} class="product-list-photo" />
                  )}
                  <span>{option.label}</span>
                  {selectedValues().has(option.value) && <span class="ui-select-indicator">✓</span>}
                </div>
              );
            })}
            <div
              aria-hidden="true"
              style={{
                height:
                  Math.max(
                    0,
                    windowedOptions().containerHeight -
                      windowedOptions().viewerTop -
                      windowedOptions().visibleItems.length * optionHeight,
                  ) + 'px',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
export function SelectField(props: SelectFieldProps) {
  return (
    <SearchableSelect
      {...props}
      value={props.options.some((o) => o.value === props.value) ? [props.value] : []}
      onChange={(values) => props.onChange(values[0] ?? '')}
    />
  );
}
export function MultiSelect(props: MultiSelectProps) {
  return <SearchableSelect {...props} multiple />;
}
