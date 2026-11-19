// Native title tooltips cover mouse users. Let touch users inspect an icon by holding it.
export function watchTouchTooltips() {
  let timer = 0;
  let tooltip: HTMLElement | undefined;
  let held: HTMLElement | undefined;

  const dismiss = () => {
    window.clearTimeout(timer);
    tooltip?.remove();
    tooltip = undefined;
  };
  const start = (event: PointerEvent) => {
    dismiss();
    held = undefined;
    if (event.pointerType !== 'touch' || !event.isPrimary || !matchMedia('(max-width: 760px)').matches)
      return;
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button[title], a.nav-item[title]')
        : null;
    if (!button?.title) return;
    timer = window.setTimeout(() => {
      held = button;
      tooltip = document.createElement('span');
      tooltip.className = 'touch-tooltip';
      tooltip.textContent = button.title;
      tooltip.setAttribute('aria-hidden', 'true');
      (button.closest('dialog') ?? document.body).append(tooltip);
      const rect = button.getBoundingClientRect();
      tooltip.style.left =
        Math.max(
          4,
          Math.min(innerWidth - tooltip.offsetWidth - 4, rect.left + (rect.width - tooltip.offsetWidth) / 2),
        ) + 'px';
      tooltip.style.top =
        (rect.top >= tooltip.offsetHeight + 8 ? rect.top - tooltip.offsetHeight - 4 : rect.bottom + 4) + 'px';
    }, 500);
  };
  const suppressClick = (event: MouseEvent) => {
    if (held && event.detail && event.target instanceof Node && held.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      held = undefined;
    }
  };
  const controller = new AbortController();
  const options = { capture: true, signal: controller.signal };
  document.addEventListener('pointerdown', start, options);
  document.addEventListener('pointerup', dismiss, options);
  document.addEventListener('pointercancel', dismiss, options);
  document.addEventListener('scroll', dismiss, options);
  window.addEventListener('click', suppressClick, options);
  return () => {
    dismiss();
    controller.abort();
  };
}
