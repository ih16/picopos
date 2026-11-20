import { createEventListener } from '@solid-primitives/event-listener';
import { createMemo, createSignal, createStore, onSettled, type Setter } from 'solid-js';

import { addScreenTab, PAGE_PATHS, parseScreenRoute, screenTabKey, type Page } from './screen-route';

export function useWorkspaceNavigation(setError: Setter<string>) {
  const [route, setRoute] = createSignal(parseScreenRoute('/dashboard'));
  const page = createMemo(() => route().page);
  const [openPages, setOpenPages] = createSignal<string[]>(['Dashboard']);
  const [mobileTabsOpen, setMobileTabsOpen] = createSignal(false);
  const [tabPaths, setTabPaths] = createStore<Record<string, string>>({ ...PAGE_PATHS });
  const navigate = (path: string, replace = false, sourceKey?: string) => {
    const next = parseScreenRoute(path);
    const hash = `#${next.path}`;
    if (window.location.hash !== hash) {
      if (replace) window.history.replaceState(window.history.state, '', hash);
      else window.history.pushState(window.history.state, '', hash);
    }
    if (next.path !== route().path) window.scrollTo(0, 0);
    setRoute(next);
    setTabPaths((paths) => {
      paths[screenTabKey(next)] = next.path;
    });
    setOpenPages((pages) => addScreenTab(pages, next, replace ? sourceKey : undefined));
    setError('');
  };
  const restoreRoute = () => {
    const next = parseScreenRoute(window.location.hash);
    if (next.path !== route().path) window.scrollTo(0, 0);
    setRoute(next);
    setTabPaths((paths) => {
      paths[screenTabKey(next)] = next.path;
    });
    setOpenPages((pages) => addScreenTab(pages, next));
    if (window.location.hash !== `#${next.path}`)
      window.history.replaceState(window.history.state, '', `#${next.path}`);
    setError('');
  };
  onSettled(restoreRoute);
  createEventListener(window, ['hashchange', 'popstate'], restoreRoute);
  const openPage = (next: string) => navigate(tabPaths[next]);
  const closePage = async (closed: string) => {
    const index = openPages().indexOf(closed);
    const remaining = openPages().filter((item) => item !== closed);
    const nextPages = remaining.length ? remaining : ['Dashboard'];
    setOpenPages(nextPages);
    if (closed in PAGE_PATHS)
      setTabPaths((paths) => {
        paths[closed] = PAGE_PATHS[closed as Page];
      });
    else
      setTabPaths((paths) => {
        delete paths[closed];
      });
    if (screenTabKey(route()) === closed)
      await navigate(tabPaths[nextPages[Math.max(0, index - 1)] ?? 'Dashboard']);
  };
  const reset = async () => {
    setTabPaths((paths) => {
      for (const key of Object.keys(paths)) delete paths[key];
      Object.assign(paths, PAGE_PATHS);
    });
    setOpenPages(['Dashboard']);
    await navigate('/dashboard', true);
  };
  return {
    route,
    page,
    openPages,
    setOpenPages,
    mobileTabsOpen,
    setMobileTabsOpen,
    tabPaths,
    navigate,
    openPage,
    closePage,
    reset,
  };
}
