import { useComputed$, useSignal, useVisibleTask$, type Signal } from '@builder.io/qwik';

import { virtualWindow } from '../lib/virtual-window';

/** Measure visible records so wrapped text and mobile cards keep their natural height. */
export function useVirtualScroll(ids: Signal<string[]>) {
  const container = useSignal<HTMLElement>();
  const measurements = useSignal<Record<string, number>>({});
  const top = useSignal(0);
  const viewport = useSignal(800);
  const estimate = useSignal(80);
  const range = useComputed$(() =>
    virtualWindow(
      ids.value.map((id) => measurements.value[id] ?? estimate.value),
      top.value,
      viewport.value,
    ),
  );

  useVisibleTask$(({ track }) => {
    track(() => ids.value.join('\n'));
    measurements.value = {};
    top.value = 0;
    if (container.value) container.value.scrollTop = 0;
  });

  useVisibleTask$(({ track, cleanup }) => {
    const element = track(() => container.value);
    track(() => range.value.start);
    track(() => range.value.end);
    track(() => ids.value.join('\n'));
    if (!element) return;
    const update = () => {
      const header = element.querySelector('thead');
      top.value = Math.max(0, element.scrollTop - (header?.getBoundingClientRect().height ?? 0));
      viewport.value = element.clientHeight;
    };
    let width = element.clientWidth;
    const measure = () => {
      const resized = width !== element.clientWidth;
      width = element.clientWidth;
      const next = resized ? {} : { ...measurements.value };
      let changed = resized;
      let total = 0;
      let count = 0;
      for (const row of element.querySelectorAll<HTMLElement>('[data-virtual-id]')) {
        const height = row.getBoundingClientRect().height;
        if (!height) continue;
        const id = row.dataset.virtualId!;
        total += height;
        count++;
        if (next[id] !== height) {
          next[id] = height;
          changed = true;
        }
      }
      if (count) estimate.value = total / count;
      if (changed) measurements.value = next;
      update();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const row of element.querySelectorAll('[data-virtual-id]')) observer.observe(row);
    element.addEventListener('scroll', update, { passive: true });
    measure();
    cleanup(() => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    });
  });
  return { container, range };
}
