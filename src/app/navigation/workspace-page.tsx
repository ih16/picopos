import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';

import { ScreenNavigation } from './screen-navigation';
import { parseScreenRoute } from './screen-route';

// Each mounted tab owns its route, so switching tabs preserves forms and filters.
type WorkspacePageProps = {
  tabKey: string;
  path: string;
  active: boolean;
  label: string;
  onNavigate: (path: string, replace?: boolean, sourceKey?: string) => void;
  onClose: (key: string) => void | Promise<void>;
} & { children?: JSX.Element };

export function WorkspacePage(props: WorkspacePageProps) {
  const route = createMemo(() => parseScreenRoute(props.path));
  const navigation = {
    route,
    navigate: (path: string, replace = false) => props.onNavigate(path, replace, props.tabKey),
    close: () => props.onClose(props.tabKey),
  };
  return (
    <ScreenNavigation value={navigation}>
      <section
        hidden={!props.active}
        class={['workspace-page stack', route().page === 'Connection' && 'settings-page']}
        aria-label={props.label}
      >
        {props.children}
      </section>
    </ScreenNavigation>
  );
}
