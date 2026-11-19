import { component$, Slot, type PropsOf, type QRL, type Signal } from '@builder.io/qwik';
import { Collapsible, Modal as HeadlessModal, Polymorphic } from '@qwik-ui/headless';
import { Icon, type IconName } from './icon';
export { Accordion } from '@qwik-ui/headless';

type ButtonProps = Omit<PropsOf<'button'>, 'ref'> & {
  icon?: IconName;
  mobileIconOnly?: boolean;
  label?: string;
  unstyled?: boolean;
  elementRef?: Signal<HTMLButtonElement | undefined>;
};

// The Styled Kit uses native elements for basic form controls. Keep their
// names, refs and validation intact while applying picopos's design tokens.
export const Button = component$<ButtonProps>(
  ({ type = 'button', class: className, icon, label, mobileIconOnly, unstyled, elementRef, ...rest }) => (
    <Polymorphic
      as="button"
      title={label ?? rest['aria-label']}
      {...rest}
      type={type}
      ref={elementRef}
      class={[
        !unstyled && 'button',
        icon && 'responsive-action',
        mobileIconOnly && 'mobile-icon-only',
        className,
      ]}
    >
      {icon && <Icon name={icon} />}
      {label && <span class="action-label">{label}</span>}
      <Slot />
    </Polymorphic>
  ),
);

type ControlSize = 'sm' | 'md';
type ControlSizeProps = { controlSize?: ControlSize };

export const Input = component$<PropsOf<'input'> & ControlSizeProps>(({ controlSize = 'md', ...props }) => (
  <input {...props} data-control-size={controlSize} />
));

export const Switch = component$<{
  label: string;
  checked: boolean;
  onChange$: PropsOf<'input'>['onChange$'];
}>(({ label, checked, onChange$ }) => (
  <label class="switch-control">
    {label}
    <input type="checkbox" role="switch" checked={checked} onChange$={onChange$} />
  </label>
));

export const Textarea = component$<PropsOf<'textarea'> & ControlSizeProps>(
  ({ controlSize = 'md', ...props }) => <textarea {...props} data-control-size={controlSize} />,
);

export const Panel = component$<PropsOf<'div'>>(({ class: className, ...rest }) => (
  <Polymorphic as="div" {...rest} class={['panel', className]}>
    <Slot />
  </Polymorphic>
));

export const Table = component$<PropsOf<'table'> & { desktopOnly?: boolean }>(({ desktopOnly, ...props }) => (
  <div class={['table-wrap', desktopOnly && 'desktop-table']}>
    <table {...props} class={['data-table', props.class]}>
      <Slot />
    </table>
  </div>
));

export const ActionBar = component$<{ label?: string; class?: string }>(
  ({ label = 'Page actions', class: className }) => (
    <div class={['action-bar', className]} role="group" aria-label={label}>
      <Slot />
    </div>
  ),
);

export const Badge = component$<{ status?: string; class?: string }>(({ status, class: className }) => (
  <Polymorphic as="span" class={['badge', className]} data-status={status}>
    <Slot />
  </Polymorphic>
));

export const Disclosure = component$<{ label: string; class?: string }>(({ label, class: className }) => (
  <Collapsible.Root class={['disclosure', className]}>
    <Collapsible.Trigger class="disclosure-trigger">
      <span>{label}</span>
      <span class="control-chevron" aria-hidden="true" />
    </Collapsible.Trigger>
    <Collapsible.Content class="disclosure-content">
      <Slot />
    </Collapsible.Content>
  </Collapsible.Root>
));

// Keep submit buttons inside their form while the fields scroll independently in dialogs.
export const EditorForm = component$<PropsOf<'form'>>(({ class: className, ...props }) => (
  <form {...props} class={[className, 'editor-form']}>
    <div class="editor-fields">
      <Slot />
    </div>
    <Slot name="actions" />
  </form>
));

export const Modal = component$<{
  dismissLabel?: string;
  open: Signal<boolean>;
  title: string;
  class?: string;
  onClose$?: QRL<() => void | Promise<void>>;
  onClosed$?: QRL<() => void | Promise<void>>;
}>(({ open, title, class: className, onClose$, onClosed$, dismissLabel }) => (
  <HeadlessModal.Root bind:show={open} closeOnBackdropClick={false} onClose$={onClose$}>
    <HeadlessModal.Panel class={['ui-modal', className]} onClose$={onClosed$}>
      <HeadlessModal.Header class="ui-modal-header">
        <HeadlessModal.Title>{title}</HeadlessModal.Title>
        <HeadlessModal.Close class="utility-button ui-modal-close" aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </HeadlessModal.Close>
        <Slot name="notice" />
      </HeadlessModal.Header>
      <HeadlessModal.Content class="ui-modal-content">
        <Slot />
      </HeadlessModal.Content>
      <Slot name="footer" />
      {dismissLabel && (
        <footer class="modal-footer">
          <HeadlessModal.Close class="button secondary">{dismissLabel}</HeadlessModal.Close>
        </footer>
      )}
    </HeadlessModal.Panel>
  </HeadlessModal.Root>
));

export { MultiSelect, SelectField } from './select';
