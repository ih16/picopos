import { $, component$, Slot, useContextProvider, useSignal, useTask$, type QRL } from '@builder.io/qwik';
import { ScreenNavigation } from './screen-navigation';
import { parseScreenRoute } from './screen-route';

// Each mounted tab owns its route, so switching tabs preserves forms and filters.
export const WorkspacePage = component$<{
  tabKey: string;
  path: string;
  active: boolean;
  label: string;
  onNavigate$: QRL<(path: string, replace?: boolean, sourceKey?: string) => void>;
  onClose$: QRL<(key: string) => void | Promise<void>>;
}>((props) => {
  const route = useSignal(parseScreenRoute(props.path));
  useTask$(({ track }) => {
    route.value = parseScreenRoute(track(() => props.path));
  });
  useContextProvider(ScreenNavigation, {
    route,
    navigate$: $((path: string, replace = false) => props.onNavigate$(path, replace, props.tabKey)),
    close$: $(() => props.onClose$(props.tabKey)),
  });
  return (
    <section
      hidden={!props.active}
      class={['workspace-page stack', route.value.page === 'Connection' && 'settings-page']}
      aria-label={props.label}
    >
      <Slot />
    </section>
  );
});
