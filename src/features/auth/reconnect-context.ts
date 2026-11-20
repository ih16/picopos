import { createContext, type Accessor } from 'solid-js';

import type { SpreadsheetSelection } from '../../infrastructure/google/google';

export const ReconnectContext = createContext<{
  saved: Accessor<SpreadsheetSelection | undefined>;
  expired: Accessor<boolean>;
  dismissed: Accessor<boolean>;
  dismiss: () => void;
  busy: Accessor<boolean>;
  error: Accessor<string>;
  onReconnect: (selection: SpreadsheetSelection) => void | Promise<void>;
}>();
