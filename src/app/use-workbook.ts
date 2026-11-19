import {
  $,
  useComputed$,
  useContextProvider,
  useSignal,
  useTask$,
  useVisibleTask$,
  type Signal,
} from '@builder.io/qwik';
import { demoWorkbook } from '../domain/demo';
import { projectLocalWorkbook, queueLocalChanges, type LocalWorkbook } from '../domain/outbox';
import {
  applyChanges,
  getInventory,
  getInventoryIssues,
  validateChanges,
  type RowChange,
  type Workbook,
  type WorkbookData,
} from '../domain/workbook';
import { ReconnectContext } from '../features/auth/reconnect-context';
import { DEFAULT_SYNC_INTERVAL_SECONDS, syncIntervalSeconds } from '../domain/sync-timing';
import {
  readSyncAttempt,
  readSyncInterval,
  storeSyncTiming,
  SYNC_INTERVAL_KEY,
  syncAttemptKey,
} from '../infrastructure/storage/sync-timing';
import {
  clearAccessToken,
  getAccessToken,
  rememberAccessToken,
  restoreAccessToken,
  watchAccessToken,
  type SpreadsheetSelection,
} from '../infrastructure/google/google';
import { initializeWorkbook, syncWorkbookBatch } from '../infrastructure/google/sheets';
import { SheetsError } from '../infrastructure/google/sheets-client';
import {
  getWorkbookLocks,
  readLocalWorkbook,
  removeLocalWorkbook,
  updateLocalWorkbook,
  watchLocalWorkbook,
} from '../infrastructure/storage/local-workbook';
import { syncWorkbookQueue } from './sync-workbook-queue';
import { addScreenTab } from './navigation/screen-route';
import type { useWorkspaceNavigation } from './navigation/use-workspace-navigation';

const SAVED_WORKBOOK = 'piecom.workbook';
const DEMO_SESSION = 'piecom.demo-session';

function saveSelection(selection?: SpreadsheetSelection) {
  try {
    if (selection) localStorage.setItem(SAVED_WORKBOOK, JSON.stringify(selection));
    else localStorage.removeItem(SAVED_WORKBOOK);
  } catch {
    // Some browser profiles restrict local storage. The current session can still connect.
  }
}

function syncLock(id: string) {
  return `piecom-workbook-sync:${id}`;
}

export function useWorkbook(error: Signal<string>, navigation: ReturnType<typeof useWorkspaceNavigation>) {
  const { reset, route, openPages } = navigation;
  const saved = useSignal<SpreadsheetSelection>();
  const setupSelection = useSignal<SpreadsheetSelection>();
  const local = useSignal<LocalWorkbook>();
  const demo = useSignal<Workbook>();
  const workbook = useComputed$(() => demo.value ?? (local.value && projectLocalWorkbook(local.value)));
  const busy = useSignal(false);
  const syncing = useSignal(false);
  const checkingSavedSession = useSignal(true);
  const syncError = useSignal('');
  const authError = useSignal('');
  const expired = useSignal(false);
  const online = useSignal(true);
  const syncInterval = useSignal(DEFAULT_SYNC_INTERVAL_SECONDS);
  const lastAttempt = useSignal(0);
  const needsReconnect = useComputed$(() => online.value && expired.value && !demo.value && !syncing.value);
  const reconnectDismissed = useSignal(false);
  useTask$(({ track }) => {
    if (!track(() => needsReconnect.value)) reconnectDismissed.value = false;
  });
  const connectionBusy = useComputed$(() => busy.value || syncing.value);
  const issues = useComputed$(() =>
    workbook.value ? getInventoryIssues(workbook.value.data, getInventory(workbook.value.data)) : [],
  );

  const showLocal = $((state: LocalWorkbook) => {
    const shown = local.value;
    if (
      saved.value?.id === state.base.id &&
      (shown?.base.id !== state.base.id || (shown.revision ?? 0) <= (state.revision ?? 0))
    ) {
      local.value = state;
    }
  });

  const reportSyncFailure = $((cause: unknown, reconnecting: boolean) => {
    if (cause instanceof SheetsError && cause.status === 401) {
      clearAccessToken();
      expired.value = true;
      syncError.value = '';
      authError.value = local.value ? '' : cause.message;
      return;
    }
    const message = cause instanceof Error ? cause.message : 'Something went wrong. Try again.';
    if (!local.value || reconnecting) authError.value = message;
    else syncError.value = message;
    if (!local.value && saved.value) expired.value = true;
  });

  const refresh = $(async (mode?: 'manual' | 'reconnect') => {
    const id = saved.value?.id;
    const reconnecting = mode === 'reconnect';
    if (!id || demo.value || busy.value || syncing.value || !online.value || (expired.value && !mode)) return;
    const intervalMs = syncInterval.value * 1_000;
    const localSyncAt = local.value?.lastSyncedAt ?? 0;
    if (!mode && local.value && Date.now() < Math.max(lastAttempt.value, localSyncAt) + intervalMs) return;
    syncing.value = true;
    if (mode) authError.value = '';
    try {
      let token = getAccessToken(true);
      if (!token) {
        await restoreAccessToken(id, true);
        token = getAccessToken(true);
      }
      if (!token) {
        expired.value = true;
        return;
      }
      const accessToken = token;
      await getWorkbookLocks().request(syncLock(id), { ifAvailable: !mode }, async (lock) => {
        if (!lock) return;
        const before = await readLocalWorkbook(id);
        const previousAttempt = Math.max(readSyncAttempt(id), lastAttempt.value);
        const startedAt = Date.now();
        lastAttempt.value = previousAttempt;
        if (
          !mode &&
          before &&
          startedAt < Math.max(previousAttempt, before.lastSyncedAt ?? 0) + syncInterval.value * 1_000
        ) {
          await showLocal(before);
          return;
        }
        lastAttempt.value = startedAt;
        storeSyncTiming(syncAttemptKey(id), startedAt);

        await syncWorkbookQueue({
          pending: before?.pending ?? [],
          syncBatch: (pending) => syncWorkbookBatch(accessToken, id, pending),
          updateLocal: (update) => updateLocalWorkbook(id, update),
          onSnapshot: showLocal,
        });
        if (reconnecting) await rememberAccessToken(id);
        expired.value = false;
        syncError.value = '';
        authError.value = '';
      });
    } catch (cause) {
      if (cause instanceof SheetsError && (cause.status === 403 || cause.status === 404)) {
        clearAccessToken();
        if (local.value) expired.value = true;
      }
      await reportSyncFailure(cause, reconnecting || expired.value);
    } finally {
      syncing.value = false;
    }
  });

  const reconnect = $(() => refresh('reconnect'));
  const syncNow = $(() => refresh('manual'));
  useContextProvider(ReconnectContext, {
    saved,
    expired: needsReconnect,
    dismissed: reconnectDismissed,
    busy: connectionBusy,
    error: authError,
    onReconnect$: reconnect,
  });

  const openSaved = $(async (id: string) => {
    try {
      const cached = await readLocalWorkbook(id);
      lastAttempt.value = readSyncAttempt(id);
      if (cached) await showLocal(cached);
      const authorized = await restoreAccessToken(id, true);
      if (saved.value?.id !== id || demo.value) return;
      expired.value = !authorized;
      if (authorized) await refresh();
    } catch (cause) {
      await reportSyncFailure(cause, false);
      if (!local.value) expired.value = true;
    } finally {
      checkingSavedSession.value = false;
    }
  });

  useVisibleTask$(
    ({ cleanup }) => {
      online.value = navigator.onLine;
      syncInterval.value = readSyncInterval();
      let restoring = false;
      try {
        if (sessionStorage.getItem(DEMO_SESSION) === 'true') {
          demo.value = { id: 'demo', title: 'Fieldwork Supply', data: demoWorkbook() };
        }
      } catch {
        /* Demo mode is optional when session storage is unavailable. */
      }
      try {
        const value: unknown = JSON.parse(localStorage.getItem(SAVED_WORKBOOK) || 'null');
        if (
          !demo.value &&
          value &&
          typeof value === 'object' &&
          'id' in value &&
          'name' in value &&
          typeof value.id === 'string' &&
          typeof value.name === 'string'
        ) {
          restoring = true;
          saved.value = { id: value.id, name: value.name };
          void openSaved(value.id);
        }
      } catch {
        // An invalid or unavailable local setting can be replaced using the picker.
      }
      if (!restoring) checkingSavedSession.value = false;
      const refreshVisible = () => {
        if (document.visibilityState === 'visible') void refresh();
      };
      const networkChanged = () => {
        online.value = navigator.onLine;
        if (online.value) refreshVisible();
      };
      document.addEventListener('visibilitychange', refreshVisible);
      window.addEventListener('focus', refreshVisible);
      window.addEventListener('online', networkChanged);
      window.addEventListener('offline', networkChanged);
      const timingChanged = ({ key }: StorageEvent) => {
        if (key === SYNC_INTERVAL_KEY || key === null) syncInterval.value = readSyncInterval();
        const id = saved.value?.id;
        if (id && (key === syncAttemptKey(id) || key === null)) lastAttempt.value = readSyncAttempt(id);
      };
      window.addEventListener('storage', timingChanged);
      cleanup(() => {
        document.removeEventListener('visibilitychange', refreshVisible);
        window.removeEventListener('focus', refreshVisible);
        window.removeEventListener('online', networkChanged);
        window.removeEventListener('offline', networkChanged);
        window.removeEventListener('storage', timingChanged);
      });
    },
    { strategy: 'document-ready' },
  );

  useVisibleTask$(
    ({ track, cleanup }) => {
      const id = track(() => saved.value?.id);
      if (!id) return;
      const stopSession = watchAccessToken(id, (authorized) => {
        if (saved.value?.id !== id || demo.value) return;
        expired.value = !authorized;
        if (authorized) {
          authError.value = '';
          void refresh();
        }
      });
      let watching = true;
      const stop = watchLocalWorkbook(id, () => {
        void readLocalWorkbook(id)
          .then((state) => {
            if (!watching || saved.value?.id !== id) return;
            if (state) void showLocal(state);
            else if (local.value?.base.id === id) {
              clearAccessToken();
              local.value = undefined;
              saved.value = undefined;
            }
          })
          .catch((cause: unknown) => {
            if (watching) void reportSyncFailure(cause, false);
          });
      });
      cleanup(() => {
        watching = false;
        stop();
        stopSession();
      });
    },
    { strategy: 'document-ready' },
  );

  useVisibleTask$(
    ({ track, cleanup }) => {
      const lastSync = track(() => local.value?.lastSyncedAt);
      const attempt = track(() => lastAttempt.value);
      const interval = track(() => syncInterval.value);
      const ready = track(
        () => online.value && !expired.value && !busy.value && !syncing.value && !demo.value,
      );
      if (lastSync === undefined || !ready) return;
      const due = Math.max(lastSync, attempt) + interval * 1_000;
      const timer = window.setTimeout(
        () => {
          if (document.visibilityState === 'visible') void refresh();
        },
        Math.max(1_000, due - Date.now()),
      );
      cleanup(() => window.clearTimeout(timer));
    },
    { strategy: 'document-ready' },
  );

  const changeSyncInterval = $((value: string) => {
    syncInterval.value = syncIntervalSeconds(value);
    storeSyncTiming(SYNC_INTERVAL_KEY, syncInterval.value);
  });

  const connect = $(
    async (selection: SpreadsheetSelection, setup?: { settings: RowChange[]; interval: string }) => {
      if (busy.value || syncing.value) return;
      const token = getAccessToken();
      if (!token) {
        if (setup)
          authError.value = 'Google authorization expired. Cancel setup and select the workbook again.';
        else expired.value = true;
        return;
      }
      busy.value = true;
      authError.value = '';
      try {
        await getWorkbookLocks().request(syncLock(selection.id), async () => {
          const selected = await initializeWorkbook(token, selection.id, setup?.settings);
          if (!selected) {
            setupSelection.value = selection;
            return;
          }
          const connection = { id: selected.id, name: selected.title };
          const state = await updateLocalWorkbook(selected.id, (previous) => ({
            ...previous,
            version: 1,
            base: selected,
            pending: previous?.pending ?? [],
            lastSyncedAt: Date.now(),
          }));
          await rememberAccessToken(selected.id);
          if ((saved.value && saved.value.id !== selected.id) || demo.value) {
            await reset();
          }
          saved.value = connection;
          lastAttempt.value = state.lastSyncedAt ?? 0;
          demo.value = undefined;
          try {
            sessionStorage.removeItem(DEMO_SESSION);
          } catch {
            /* Storage may be unavailable. */
          }
          saveSelection(connection);
          await showLocal(state);
          expired.value = false;
          syncError.value = '';
          error.value = '';
          if (setup) await changeSyncInterval(setup.interval);
          setupSelection.value = undefined;
          void navigator.storage.persist?.().catch(() => {});
        });
      } catch (cause) {
        if (setup)
          authError.value = cause instanceof Error ? cause.message : 'Could not save workbook setup.';
        else await reportSyncFailure(cause, true);
      } finally {
        busy.value = false;
      }
    },
  );

  const openDemo = $(() => {
    try {
      sessionStorage.setItem(DEMO_SESSION, 'true');
    } catch {
      /* Demo still works in memory. */
    }
    demo.value = { id: 'demo', title: 'Fieldwork Supply', data: demoWorkbook() };
    error.value = '';
    openPages.value = addScreenTab([], route.value);
  });

  const disconnect = $(async () => {
    const id = saved.value?.id;
    if (!id || busy.value || syncing.value) return;
    busy.value = true;
    authError.value = '';
    try {
      await getWorkbookLocks().request(syncLock(id), async () => {
        await removeLocalWorkbook(id);
        clearAccessToken();
        saveSelection();
        local.value = undefined;
        saved.value = undefined;
        expired.value = false;
        error.value = '';
        syncError.value = '';
      });
    } catch (cause) {
      authError.value = cause instanceof Error ? cause.message : 'Could not disconnect this workbook.';
    } finally {
      busy.value = false;
    }
  });

  const discardChange = $(async (id: string) => {
    const workbookId = local.value?.base.id;
    if (!workbookId || busy.value || syncing.value) return;
    busy.value = true;
    error.value = '';
    try {
      await getWorkbookLocks().request(syncLock(workbookId), async () => {
        const next = await updateLocalWorkbook(workbookId, (current) => {
          if (!current) throw new Error('Reconnect the workbook before changing the sync queue.');
          return { ...current, pending: current.pending.filter((item) => item.id !== id || !item.issue) };
        });
        await showLocal(next);
      });
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not discard the local change.';
    } finally {
      busy.value = false;
    }
  });

  const commit = $(async (changes: RowChange[], editBase?: WorkbookData | RowChange[]) => {
    const current = workbook.value;
    if (!current || busy.value) return false;
    busy.value = true;
    error.value = '';
    try {
      if (demo.value) {
        validateChanges(current.data, changes);
        demo.value = { ...current, data: applyChanges(current.data, changes) };
      } else {
        const next = await updateLocalWorkbook(current.id, (state) => {
          if (!state) throw new Error('Reconnect the workbook before saving changes.');
          return queueLocalChanges(state, changes, editBase ?? current);
        });
        await showLocal(next);
      }
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not save this change on this device.';
      return false;
    } finally {
      busy.value = false;
    }
  });

  const leaveDemo = $(async () => {
    try {
      sessionStorage.removeItem(DEMO_SESSION);
    } catch {
      /* Storage may be unavailable. */
    }
    demo.value = undefined;
    await reset();
    error.value = '';
  });

  return {
    saved,
    local,
    demo,
    workbook,
    busy,
    syncing,
    checkingSavedSession,
    syncError,
    authError,
    expired,
    online,
    syncInterval,
    needsReconnect,
    connectionBusy,
    issues,
    connect,
    setupSelection,
    openDemo,
    disconnect,
    discardChange,
    commit,
    syncNow,
    changeSyncInterval,
    leaveDemo,
  };
}
