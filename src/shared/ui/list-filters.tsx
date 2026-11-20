import { createMediaQuery } from '@solid-primitives/media';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal } from 'solid-js';

import { Button, Modal } from './controls';
import { Icon } from './icon';

type ListFiltersProps = { title: string; count: number; class?: string } & { children?: JSX.Element };

export function ListFilters(props: ListFiltersProps) {
  const mobile = createMediaQuery('(max-width: 760px)');
  const [open, setOpen] = createSignal(false);
  createEffect(mobile, (narrow) => {
    if (!narrow) setOpen(false);
  });

  return (
    <>
      {!mobile() ? (
        <div class={['row filters inline-list-filters', props.class]}>{props.children}</div>
      ) : (
        <>
          <Button
            class="secondary filter-trigger"
            title={props.title}
            aria-label={props.count ? `${props.title}, ${props.count} active` : props.title}
            aria-haspopup="dialog"
            aria-expanded={open() ? 'true' : 'false'}
            onClick={() => {
              setOpen(true);
            }}
          >
            <Icon name="filter" />
            {props.count > 0 && (
              <span class="filter-count" aria-hidden="true">
                {props.count}
              </span>
            )}
          </Button>
          <Modal open={open()} onDismiss={() => setOpen(false)} title={props.title} dismissLabel="Done">
            <div class="stack filter-fields">{props.children}</div>
          </Modal>
        </>
      )}
    </>
  );
}
