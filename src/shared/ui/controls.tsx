import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';

import { Icon, type IconName } from './icon';

export { Modal } from './modal';
export { MultiSelect, SelectField } from './select';

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];
type Children = { children?: JSX.Element };
type Sized = { controlSize?: 'sm' | 'md' };

export function Button(
  props: PropsOf<'button'> & {
    icon?: IconName;
    mobileIconOnly?: boolean;
    label?: string;
    unstyled?: boolean;
  },
) {
  return (
    <button
      {...omit(
        props,
        'icon',
        'mobileIconOnly',
        'label',
        'unstyled',

        'children',
        'class',
        'type',
        'title',
      )}

      type={props.type ?? 'button'}
      title={props.title ?? props.label ?? props['aria-label']}
      class={[
        !props.unstyled && 'button',
        props.icon && 'responsive-action',
        props.mobileIconOnly && 'mobile-icon-only',
        props.class,
      ]}
    >
      {props.icon && <Icon name={props.icon} />}
      {props.label && <span class="action-label">{props.label}</span>}
      {props.children}
    </button>
  );
}
export function Input(props: PropsOf<'input'> & Sized) {
  return <input {...omit(props, 'controlSize')} data-control-size={props.controlSize ?? 'md'} />;
}
export function Textarea(props: PropsOf<'textarea'> & Sized) {
  return <textarea {...omit(props, 'controlSize')} data-control-size={props.controlSize ?? 'md'} />;
}
type SwitchProps = { label: string; checked: boolean; onChange: PropsOf<'input'>['onChange'] };

export function Switch(props: SwitchProps) {
  return (
    <label class="switch-control">
      {props.label}
      <input type="checkbox" role="switch" checked={props.checked} onChange={props.onChange} />
    </label>
  );
}
export function Panel(props: PropsOf<'div'>) {
  return <div {...omit(props, 'class')} class={['panel', props.class]} />;
}
export function Table(props: PropsOf<'table'> & { desktopOnly?: boolean; paged?: boolean }) {
  return (
    <div class={['table-wrap', props.desktopOnly && 'desktop-table', props.paged && 'paged-viewport']}>
      <table {...omit(props, 'class', 'desktopOnly', 'paged')} class={['data-table', props.class]} />
    </div>
  );
}
type ActionBarProps = Children & { label?: string; class?: string };

export function ActionBar(props: ActionBarProps) {
  return (
    <div class={['action-bar', props.class]} role="group" aria-label={props.label ?? 'Page actions'}>
      {props.children}
    </div>
  );
}
type BadgeProps = Children & { status?: string; class?: string };

export function Badge(props: BadgeProps) {
  return (
    <span class={['badge', props.class]} data-status={props.status}>
      {props.children}
    </span>
  );
}
type DisclosureProps = Children & { label: string; class?: string };

export function Disclosure(props: DisclosureProps) {
  return (
    <details class={['disclosure', props.class]}>
      <summary class="disclosure-trigger">
        <span>{props.label}</span>
        <span class="control-chevron" aria-hidden="true" />
      </summary>
      <div class="disclosure-content">{props.children}</div>
    </details>
  );
}
type EditorFormProps = Omit<PropsOf<'form'>, 'onSubmit'> & {
  actions?: JSX.Element;
  onSubmit: (event: SubmitEvent) => unknown;
};

export function EditorForm(props: EditorFormProps) {
  return (
    <form
      {...omit(props, 'actions', 'children', 'class', 'onSubmit')}
      class={[props.class, 'editor-form']}
      onSubmit={(event) => {
        event.preventDefault();
        void props.onSubmit(event);
      }}
    >
      <div class="editor-fields">{props.children}</div>
      {props.actions}
    </form>
  );
}
