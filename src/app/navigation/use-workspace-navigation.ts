import { $, useComputed$, useSignal, useStore, useVisibleTask$, type Signal } from '@builder.io/qwik';
import { addScreenTab, PAGE_PATHS, parseScreenRoute, screenTabKey, type Page } from './screen-route';

export function useWorkspaceNavigation(error: Signal<string>) {
  const route = useSignal(parseScreenRoute('/orders'));
  const page = useComputed$(() => route.value.page);
  const openPages = useSignal<string[]>(['Orders']);
  const mobileTabsOpen = useSignal(false);
  const tabPaths = useStore<Record<string, string>>({ ...PAGE_PATHS });
  const navigate = $((path: string, replace = false, sourceKey?: string) => {
    const next = parseScreenRoute(path);
    const hash = `#${next.path}`;
    if (window.location.hash !== hash) {
      if (replace) window.history.replaceState(window.history.state, '', hash);
      else window.history.pushState(window.history.state, '', hash);
    }
    route.value = next;
    tabPaths[screenTabKey(next)] = next.path;
    openPages.value = addScreenTab(openPages.value, next, replace ? sourceKey : undefined);
    error.value = '';
  });
  useVisibleTask$(
    ({ cleanup }) => {
      const restoreRoute = () => {
        const next = parseScreenRoute(window.location.hash);
        route.value = next;
        tabPaths[screenTabKey(next)] = next.path;
        openPages.value = addScreenTab(openPages.value, next);
        if (window.location.hash !== `#${next.path}`)
          window.history.replaceState(window.history.state, '', `#${next.path}`);
        error.value = '';
      };
      restoreRoute();
      window.addEventListener('hashchange', restoreRoute);
      window.addEventListener('popstate', restoreRoute);
      cleanup(() => {
        window.removeEventListener('hashchange', restoreRoute);
        window.removeEventListener('popstate', restoreRoute);
      });
    },
    { strategy: 'document-ready' },
  );
  const openPage = $((next: string) => navigate(tabPaths[next]));
  const closePage = $(async (closed: string) => {
    const index = openPages.value.indexOf(closed);
    const remaining = openPages.value.filter((item) => item !== closed);
    openPages.value = remaining.length ? remaining : ['Orders'];
    if (closed in PAGE_PATHS) tabPaths[closed] = PAGE_PATHS[closed as Page];
    else delete tabPaths[closed];
    if (screenTabKey(route.value) === closed)
      await navigate(tabPaths[openPages.value[Math.max(0, index - 1)] ?? 'Orders']);
  });
  const reset = $(async () => {
    for (const key of Object.keys(tabPaths)) delete tabPaths[key];
    Object.assign(tabPaths, PAGE_PATHS);
    openPages.value = ['Orders'];
    await navigate('/orders', true);
  });
  return { route, page, openPages, mobileTabsOpen, tabPaths, navigate, openPage, closePage, reset };
}
