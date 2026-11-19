import { component$, Slot, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { Button, Modal } from './controls';
import { Icon } from './icon';

export const ListFilters = component$<{ title: string; count: number; class?: string }>((props) => {
  const mobile = useSignal(false);
  const open = useSignal(false);
  useVisibleTask$(
    ({ cleanup }) => {
      const media = window.matchMedia('(max-width: 760px)');
      const update = () => {
        mobile.value = media.matches;
        if (!media.matches) open.value = false;
      };
      update();
      media.addEventListener('change', update);
      cleanup(() => media.removeEventListener('change', update));
    },
    { strategy: 'document-ready' },
  );

  if (!mobile.value)
    return (
      <div class={['row filters inline-list-filters', props.class]}>
        <Slot />
      </div>
    );

  return (
    <>
      <Button
        class="secondary filter-trigger"
        title={props.title}
        aria-label={props.count ? `${props.title}, ${props.count} active` : props.title}
        aria-haspopup="dialog"
        aria-expanded={open.value}
        onClick$={() => {
          open.value = true;
        }}
      >
        <Icon name="filter" />
        {props.count > 0 && (
          <span class="filter-count" aria-hidden="true">
            {props.count}
          </span>
        )}
      </Button>
      <Modal open={open} title={props.title} dismissLabel="Done">
        <div class="stack filter-fields">
          <Slot />
        </div>
      </Modal>
    </>
  );
});
