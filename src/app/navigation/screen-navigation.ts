import { createContextId, type QRL, type Signal } from '@builder.io/qwik';
import type { ScreenRoute } from './screen-route';

export const ScreenNavigation = createContextId<{
  route: Signal<ScreenRoute>;
  close$: QRL<() => void | Promise<void>>;
  navigate$: QRL<(path: string, replace?: boolean) => void>;
}>('picopos.screen-navigation');
