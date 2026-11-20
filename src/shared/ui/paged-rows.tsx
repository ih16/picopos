import { createEventListener } from '@solid-primitives/event-listener';
import { createResizeObserver } from '@solid-primitives/resize-observer';
import { createVirtualList } from '@solid-primitives/virtual';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, For, type Accessor } from 'solid-js';

import { PAGE_SIZE, BAND_HEIGHT, pageLayout } from '../lib/page-layout';

type PagedRowsProps<T> = {
  rows: T[];
  estimate: number;
  table?: boolean;
  list?: boolean;
  resetKey?: string;
  children: (rows: Accessor<T[]>) => JSX.Element;
};

/** Pages keep wrapped rows and expanded records together. The Solid virtualizer
 * windows pixel bands, which can intersect more than one variable-height page. */
export function PagedRows<T>(props: PagedRowsProps<T>) {
  return (
    <>
      {props.rows.length > PAGE_SIZE ? (
        <VirtualPages {...props} />
      ) : props.table ? (
        <tbody>{props.children(() => props.rows)}</tbody>
      ) : (
        props.children(() => props.rows)
      )}
    </>
  );
}

function VirtualPages<T>(props: PagedRowsProps<T>) {
  const [marker, setMarker] = createSignal<HTMLElement>();
  const [viewport, setViewport] = createSignal<HTMLElement>();
  const [height, setHeight] = createSignal(600);
  const [sizes, setSizes] = createSignal<Record<number, number>>({});
  const layout = createMemo(() => {
    return pageLayout(props.rows.length, props.estimate, sizes());
  });
  const [window, onScroll] = createVirtualList({
    items: () => layout().bands,
    rowHeight: BAND_HEIGHT,
    rootHeight: height,
    overscanCount: 1,
  });
  const pages = createMemo(() => {
    const { visibleItems } = window();
    const lastPage = layout().starts.length - 2;
    if (lastPage < 0) return [];
    const first = visibleItems[0]?.first ?? lastPage;
    const last = visibleItems.at(-1)?.last ?? lastPage;
    return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
  });
  createEffect(marker, (el) => {
    setViewport(el?.closest<HTMLElement>('.paged-viewport') ?? undefined);
  });
  createEventListener(viewport, 'scroll', onScroll, { passive: true });
  createResizeObserver(viewport, (rect) => {
    if (rect.height) setHeight(rect.height);
  });
  createEffect(
    () => [props.resetKey, viewport()] as const,
    ([, element]) => {
      if (element) element.scrollTop = 0;
      setSizes({});
    },
  );
  const spacer = (pixels: Accessor<number>, first = false) => {
    const style = () => ({ height: pixels() + 'px' });
    const ref = (el: HTMLElement) => {
      if (first) setMarker(el);
    };
    return props.table ? (
      <tbody aria-hidden="true" ref={ref} class="page-spacer">
        <tr>
          <td style={style()} />
        </tr>
      </tbody>
    ) : props.list ? (
      <li aria-hidden="true" ref={ref} class="page-spacer" style={style()} />
    ) : (
      <div aria-hidden="true" ref={ref} class="page-spacer" style={style()} />
    );
  };
  return (
    <>
      {spacer(() => layout().starts[pages()[0] ?? 0] ?? 0, true)}
      <For each={pages()}>
        {(page) => {
          const rows = createMemo(() => props.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
          const [group, setGroup] = createSignal<HTMLElement>();
          createResizeObserver(group, (_rect, el) => {
            const height = el.getBoundingClientRect().height;
            if (height > 0)
              setSizes((previous) =>
                previous[page] === height ? previous : { ...previous, [page]: height },
              );
          });
          return props.table ? (
            <tbody ref={setGroup}>{props.children(rows)}</tbody>
          ) : props.list ? (
            <li>
              <ul class="paged-group" ref={setGroup}>
                {props.children(rows)}
              </ul>
            </li>
          ) : (
            <div class="paged-group" ref={setGroup}>
              {props.children(rows)}
            </div>
          );
        }}
      </For>
      {spacer(() => (layout().starts.at(-1) ?? 0) - (layout().starts[(pages().at(-1) ?? -1) + 1] ?? 0))}
    </>
  );
}
