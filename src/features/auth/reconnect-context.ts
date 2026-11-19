import { createContextId, type QRL, type Signal } from '@builder.io/qwik';
import type { SpreadsheetSelection } from '../../infrastructure/google/google';

export const ReconnectContext = createContextId<{
  saved: Signal<SpreadsheetSelection | undefined>;
  expired: Signal<boolean>;
  dismissed: Signal<boolean>;
  busy: Signal<boolean>;
  error: Signal<string>;
  onReconnect$: QRL<(selection: SpreadsheetSelection) => void | Promise<void>>;
}>('picopos.google-reconnect');
