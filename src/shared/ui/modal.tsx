import type { JSX } from '@solidjs/web';
import { createEffect, type ParentProps } from 'solid-js';

type ModalProps = ParentProps<{
  open: boolean;
  onDismiss: () => void;
  title: string;
  class?: string;
  dismissLabel?: string;
  notice?: JSX.Element;
  footer?: JSX.Element;

  onClosed?: () => unknown;
}>;

export function Modal(props: ModalProps) {
  let dialog!: HTMLDialogElement;
  const titleId = crypto.randomUUID();

  createEffect(
    () => props.open,
    (open) => {
      if (open) {
        if (!dialog.open) dialog.showModal();
        return;
      }
      if (!dialog.open) return;
      dialog.dataset.closing = '';
      const animations = dialog.getAnimations();
      const finish = () => {
        if (!props.open && dialog.open) dialog.close();
      };
      if (animations.length)
        void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
      else finish();
      return () => {
        delete dialog.dataset.closing;
      };
    },
  );
  return (
    <dialog
      ref={dialog}
      class={['ui-modal', props.class]}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        props.onDismiss();
      }}
      onClose={() => {
        if (!dialog.open) void props.onClosed?.();
      }}
    >
      <header class="ui-modal-header">
        <h2 id={titleId}>{props.title}</h2>
        <button
          type="button"
          class="utility-button ui-modal-close"
          aria-label="Close dialog"
          onClick={() => props.onDismiss()}
        >
          ×
        </button>
        {props.notice}
      </header>
      <div class="ui-modal-content">{props.children}</div>
      {props.footer}
      {props.dismissLabel && (
        <footer class="modal-footer">
          <button type="button" class="button secondary" onClick={() => props.onDismiss()}>
            {props.dismissLabel}
          </button>
        </footer>
      )}
    </dialog>
  );
}
