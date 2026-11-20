import { createContext, type Accessor } from 'solid-js';

import type { ScreenRoute } from './screen-route';

export const ScreenNavigation = createContext<{
  route: Accessor<ScreenRoute>;
  close: () => void | Promise<void>;
  navigate: (path: string, replace?: boolean) => void;
}>();
