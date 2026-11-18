const scrollAreas = [
  '.settings-page',
  '.dashboard-scroll',
  '.orders-list > .table-wrap',
  '.orders-list > .mobile-records',
  '.orders-list > .empty',
  '.catalog-page > .product-grid',
  '.component-scroll',
  '.order-draft-form',
  '.ui-modal-content',
].join(',');

/** Keep the last record reachable behind viewport-fixed actions, without shrinking the shell. */
export function watchActionBarClearance() {
  const adjusted = new Set<HTMLElement>();
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resize = new ResizeObserver(schedule);
  const observed = new Set<Element>();
  const update = () => {
    frame = 0;
    const areas = [...document.querySelectorAll<HTMLElement>(scrollAreas)];
    const bars = [...document.querySelectorAll<HTMLElement>('.action-bar')];
    const targets = new Set<Element>([...areas, ...bars]);
    for (const element of observed) {
      if (!targets.has(element)) {
        resize.unobserve(element);
        observed.delete(element);
      }
    }
    for (const element of targets) {
      if (!observed.has(element)) {
        resize.observe(element);
        observed.add(element);
      }
    }
    const floating = bars
      .filter((bar) => bar.getClientRects().length && getComputedStyle(bar).position === 'fixed')
      .map((bar) => ({ bar, rect: bar.getBoundingClientRect() }));
    for (const area of areas) {
      const rect = area.getBoundingClientRect();
      let clearance = 0;
      if (area.getClientRects().length && /auto|scroll/.test(getComputedStyle(area).overflowY)) {
        for (const { bar, rect: action } of floating) {
          // A modal's controls only obstruct that modal, not the workspace beneath it.
          if (area.closest('dialog') !== bar.closest('dialog')) continue;
          if (
            rect.left < action.right &&
            rect.right > action.left &&
            rect.bottom > action.top &&
            rect.top < action.bottom
          ) {
            clearance = Math.max(clearance, Math.ceil(rect.bottom - action.top + 12));
          }
        }
      }
      if (clearance) {
        const value = `${clearance}px`;
        if (area.style.getPropertyValue('--floating-action-clearance') !== value)
          area.style.setProperty('--floating-action-clearance', value);
        area.setAttribute('data-action-clearance', '');
        adjusted.add(area);
      } else if (adjusted.delete(area)) {
        area.style.removeProperty('--floating-action-clearance');
        area.removeAttribute('data-action-clearance');
      }
    }
    for (const area of adjusted) if (!area.isConnected) adjusted.delete(area);
  };
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'open'],
  });
  window.addEventListener('resize', schedule);
  document.addEventListener('scroll', schedule, true);
  schedule();
  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    window.removeEventListener('resize', schedule);
    document.removeEventListener('scroll', schedule, true);
    for (const area of adjusted) {
      area.style.removeProperty('--floating-action-clearance');
      area.removeAttribute('data-action-clearance');
    }
  };
}
