import { createEventListener } from '@solid-primitives/event-listener';
import { createEffect, createMemo, createSignal, flush, onSettled, type Setter } from 'solid-js';

import { demoWorkbook } from '../domain/demo';
import { projectLocalWorkbook, queueLocalChanges, type LocalWorkbook } from '../domain/outbox';
import { DEFAULT_SYNC_INTERVAL_SECONDS, syncIntervalSeconds } from '../domain/sync-timing';
import {
  applyChanges,
  getInventory,
  getInventoryIssues,
  validateChanges,
  type RowChange,
  type Workbook,
  type WorkbookData,
} from '../domain/workbook';
import {
  clearAccessToken,
  getAccessSession,
  getSyncAccessSession,
  invalidateAccessSession,
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
import {
  readSyncAttempt,
  readSyncRetry,
  syncRetryKey,
  readSyncInterval,
  storeSyncTiming,
  SYNC_INTERVAL_KEY,
  syncAttemptKey,
} from '../infrastructure/storage/sync-timing';
import { addScreenTab } from './navigation/screen-route';
import type { useWorkspaceNavigation } from './navigation/use-workspace-navigation';
import { syncWorkbookQueue } from './sync-workbook-queue';

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

export function useWorkbook(setError: Setter<string>, navigation: ReturnType<typeof useWorkspaceNavigation>) {
  const { reset, route, setOpenPages } = navigation;
  const [saved, setSaved] = createSignal<SpreadsheetSelection>();
  const [setupSelection, setSetupSelection] = createSignal<SpreadsheetSelection>();
  const [local, setLocal] = createSignal<LocalWorkbook>();
  const [demo, setDemo] = createSignal<Workbook>();
  const workbook = createMemo(() => {
    const snapshot = local();
    return demo() ?? (snapshot && projectLocalWorkbook(snapshot));
  });
  const [busy, setBusy] = createSignal(false);
  const [syncing, setSyncing] = createSignal(false);
  const [checkingSavedSession, setCheckingSavedSession] = createSignal(true);
  const [syncError, setSyncError] = createSignal('');
  const [authError, setAuthError] = createSignal('');
  const [expired, setExpired] = createSignal(false);
  const [online, setOnline] = createSignal(true);
  const [syncInterval, setSyncInterval] = createSignal(DEFAULT_SYNC_INTERVAL_SECONDS);
  const [nextSyncAt, setNextSyncAt] = createSignal<number>();
  const [lastAttempt, setLastAttempt] = createSignal(0);
  const [quotaPause, setQuotaPause] = createSignal({ id: '', until: 0 });
  const retryAt = createMemo(() => (quotaPause().id === saved()?.id ? quotaPause().until : 0));
  let reauthorizedWorkbook: string | undefined;
  const recordQuotaPause = (id: string, until: number) => {
    storeSyncTiming(syncRetryKey(id), until);
    setQuotaPause({ id, until });
  };
  const needsReconnect = createMemo(() => online() && expired() && !demo() && !syncing());
  const [reconnectDismissed, setReconnectDismissed] = createSignal(false);
  createEffect(
    () => needsReconnect(),
    (reconnect) => {
      if (!reconnect) setReconnectDismissed(false);
    },
  );
  const connectionBusy = createMemo(() => busy() || syncing());
  const issues = createMemo(() => {
    const data = workbook()?.data;
    return data ? getInventoryIssues(data, getInventory(data)) : [];
  });

  const showLocal = (state: LocalWorkbook) => {
    if (saved()?.id !== state.base.id) return;
    setLocal((shown) =>
      shown?.base.id === state.base.id && (shown.revision ?? 0) > (state.revision ?? 0) ? shown : state,
    );
  };

  const reportSyncFailure = (cause: unknown, reconnecting: boolean) => {
    if (cause instanceof SheetsError && cause.status === 401) {
      setExpired(true);
      setSyncError('');
      setAuthError(local() ? '' : cause.message);
      return;
    }
    const message = cause instanceof Error ? cause.message : 'Something went wrong. Try again.';
    if (!local() || reconnecting) setAuthError(message);
    else setSyncError(message);
  };

  // Commands can follow another write in the same tick (reauthorization, reconnect, or a demo edit).
  // Commit pending signals before checking the workbook identity and operation guards.
  const refresh = async (mode?: 'manual' | 'reconnect') => {
    flush();
    const id = saved()?.id;
    const reconnecting = mode === 'reconnect';
    if (!id || demo() || busy() || syncing() || !online() || (expired() && !mode)) return;
    const intervalMs = syncInterval() * 1_000;
    const localSyncAt = local()?.lastSyncedAt ?? 0;
    if (!mode && local() && Date.now() < Math.max(lastAttempt(), localSyncAt) + intervalMs) return;
    setSyncing(true);
    if (mode) setAuthError('');
    try {
      await getWorkbookLocks().request(syncLock(id), { ifAvailable: !mode }, async (lock) => {
        if (!lock) return;
        let before = await readLocalWorkbook(id);
        const previousAttempt = Math.max(readSyncAttempt(id), lastAttempt());
        const startedAt = Date.now();
        setLastAttempt(previousAttempt);
        if (
          !mode &&
          before &&
          startedAt < Math.max(previousAttempt, before.lastSyncedAt ?? 0) + syncInterval() * 1_000
        ) {
          showLocal(before);
          return;
        }

        // Resolve credentials after acquiring the lock since another tab may
        // have reconnected while this sync was waiting.
        let credential = await getSyncAccessSession(id);
        if (!credential) {
          setExpired(true);
          return;
        }
        if (reconnecting) {
          reauthorizedWorkbook = id;
          setExpired(false);
        }
        const until = Math.max(readSyncRetry(id), retryAt());
        if (startedAt < until) {
          setQuotaPause({ id, until });
          return;
        }
        setLastAttempt(startedAt);
        storeSyncTiming(syncAttemptKey(id), startedAt);

        for (let attempt = 0; ; attempt++) {
          const usedSession = credential;
          try {
            await syncWorkbookQueue({
              pending: before?.pending ?? [],
              syncBatch: (pending) => syncWorkbookBatch(usedSession.value, id, pending),
              updateLocal: (update) => updateLocalWorkbook(id, update),
              onSnapshot: showLocal,
            });
            break;
          } catch (cause) {
            if (cause instanceof SheetsError && cause.retryAt !== undefined) {
              recordQuotaPause(id, cause.retryAt);
              setSyncError('Google Sheets temporarily limited requests. Sync will retry automatically.');
              setAuthError(local() ? '' : cause.message);
              return;
            }
            if (!(cause instanceof SheetsError) || ![401, 403, 404].includes(cause.status ?? 0)) throw cause;
            if (await invalidateAccessSession(usedSession)) {
              setExpired(true);
              throw cause;
            }
            const renewed = await getSyncAccessSession(id);
            setExpired(!renewed);
            if (!renewed || renewed.value === usedSession.value || attempt > 0) return;
            // Re-read the outbox and Sheets with the renewed credential. Never replay a raw write.
            credential = renewed;
            before = await readLocalWorkbook(id);
          }
        }
        if (reauthorizedWorkbook === id) await rememberAccessToken(id, credential);
        reauthorizedWorkbook = undefined;
        setExpired(false);
        setSyncError('');
        setAuthError('');
      });
    } catch (cause) {
      reportSyncFailure(cause, expired());
    } finally {
      setSyncing(false);
    }
  };

  const reconnect = () => refresh('reconnect');
  const syncNow = () => refresh('manual');
  const reconnectContext = {
    saved,
    expired: needsReconnect,
    dismissed: reconnectDismissed,
    dismiss: () => setReconnectDismissed(true),
    busy: connectionBusy,
    error: authError,
    onReconnect: reconnect,
  };

  const openSaved = async (id: string) => {
    try {
      const cached = await readLocalWorkbook(id);
      setLastAttempt(readSyncAttempt(id));
      setQuotaPause({ id, until: readSyncRetry(id) });
      if (cached) showLocal(cached);
      const authorized = await restoreAccessToken(id, true);
      if (saved()?.id !== id || demo()) return;
      setExpired(!authorized);
      if (authorized) await refresh();
    } catch (cause) {
      await reportSyncFailure(cause, false);
      if (!local()) setExpired(true);
    } finally {
      setCheckingSavedSession(false);
    }
  };

  onSettled(() => {
    setOnline(navigator.onLine);
    setSyncInterval(readSyncInterval());
    let restoring = false;
    let restoringDemo = false;
    try {
      if (sessionStorage.getItem(DEMO_SESSION) === 'true') {
        restoringDemo = true;
        setDemo({ id: 'demo', title: 'Fieldwork Supply', data: demoWorkbook() });
      }
    } catch {
      /* Demo mode is optional when session storage is unavailable. */
    }
    try {
      const value: unknown = JSON.parse(localStorage.getItem(SAVED_WORKBOOK) || 'null');
      if (
        !restoringDemo &&
        value &&
        typeof value === 'object' &&
        'id' in value &&
        'name' in value &&
        typeof value.id === 'string' &&
        typeof value.name === 'string'
      ) {
        restoring = true;
        setSaved({ id: value.id, name: value.name });
        void openSaved(value.id);
      }
    } catch {
      // An invalid or unavailable local setting can be replaced using the picker.
    }
    if (!restoring) setCheckingSavedSession(false);
  });
  const refreshVisible = () => {
    if (document.visibilityState === 'visible') void refresh();
  };
  const networkChanged = () => {
    setOnline(navigator.onLine);
    if (navigator.onLine) refreshVisible();
  };
  const timingChanged = ({ key }: StorageEvent) => {
    if (key === SYNC_INTERVAL_KEY || key === null) setSyncInterval(readSyncInterval());
    const id = saved()?.id;
    if (id && (key === syncRetryKey(id) || key === null)) setQuotaPause({ id, until: readSyncRetry(id) });
    if (id && (key === syncAttemptKey(id) || key === null)) setLastAttempt(readSyncAttempt(id));
  };
  createEventListener(document, 'visibilitychange', refreshVisible);
  createEventListener(window, 'focus', refreshVisible);
  createEventListener(window, ['online', 'offline'], networkChanged);
  createEventListener(window, 'storage', timingChanged);

  createEffect(
    () => saved()?.id,
    (id) => {
      if (!id) return;
      const stopSession = watchAccessToken(id, (authorized) => {
        if (saved()?.id !== id || demo()) return;
        setExpired(!authorized);
        if (authorized) {
          setAuthError('');
          void refresh();
        }
      });
      let watching = true;
      const stop = watchLocalWorkbook(id, () => {
        void readLocalWorkbook(id)
          .then((state) => {
            if (!watching || saved()?.id !== id) return;
            if (state) void showLocal(state);
            else if (local()?.base.id === id) {
              clearAccessToken();
              setLocal(undefined);
              setSaved(undefined);
            }
          })
          .catch((cause: unknown) => {
            if (watching) void reportSyncFailure(cause, false);
          });
      });
      return () => {
        watching = false;
        stop();
        stopSession();
      };
    },
  );

  createEffect(
    () =>
      [
        local()?.lastSyncedAt ?? 0,
        retryAt(),
        lastAttempt(),
        syncInterval(),
        Boolean(saved()) &&
          !checkingSavedSession() &&
          online() &&
          !expired() &&
          !busy() &&
          !syncing() &&
          !demo(),
      ] as const,
    ([lastSync, until, attempt, interval, ready]) => {
      if (!ready) return;
      const due = Math.max(until, Math.max(lastSync, attempt) + interval * 1_000);
      const now = Date.now();
      const delay = Math.max(1_000, due - now);
      setNextSyncAt(now + delay);
      const timer = window.setTimeout(() => {
        setNextSyncAt(undefined);
        if (document.visibilityState === 'visible') void refresh();
      }, delay);
      return () => {
        window.clearTimeout(timer);
        setNextSyncAt(undefined);
      };
    },
  );

  const changeSyncInterval = (value: string) => {
    const seconds = syncIntervalSeconds(value);
    setSyncInterval(seconds);
    storeSyncTiming(SYNC_INTERVAL_KEY, seconds);
  };

  const connect = async (
    selection: SpreadsheetSelection,
    setup?: { settings: RowChange[]; interval: string },
  ) => {
    flush();
    if (busy() || syncing()) return;
    const session = getAccessSession();
    if (!session) {
      if (setup) setAuthError('Google authorization expired. Cancel setup and select the workbook again.');
      else setExpired(true);
      return;
    }
    setBusy(true);
    setAuthError('');
    try {
      await getWorkbookLocks().request(syncLock(selection.id), async () => {
        const until = Math.max(
          readSyncRetry(selection.id),
          quotaPause().id === selection.id ? quotaPause().until : 0,
        );
        if (Date.now() < until) {
          setAuthError(
            'Google Sheets temporarily limited requests. Try again after ' +
              new Date(until).toLocaleTimeString() +
              '.',
          );
          return;
        }
        const selected = await initializeWorkbook(session.value, selection.id, setup?.settings);
        if (!selected) {
          setSetupSelection(selection);
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
        await rememberAccessToken(selected.id, session);
        if ((saved() && saved()?.id !== selected.id) || demo()) {
          await reset();
        }
        setSaved(connection);
        setLastAttempt(state.lastSyncedAt ?? 0);
        setDemo(undefined);
        try {
          sessionStorage.removeItem(DEMO_SESSION);
        } catch {
          /* Storage may be unavailable. */
        }
        saveSelection(connection);
        flush();
        showLocal(state);
        setExpired(false);
        setSyncError('');
        setError('');
        if (setup) await changeSyncInterval(setup.interval);
        setSetupSelection(undefined);
        void navigator.storage.persist?.().catch(() => {});
      });
    } catch (cause) {
      if (cause instanceof SheetsError && cause.retryAt !== undefined) {
        recordQuotaPause(selection.id, cause.retryAt);
        setAuthError(cause.message);
        return;
      }
      if (cause instanceof SheetsError && cause.status === 401) {
        if (!(await invalidateAccessSession(session))) return;
      }
      if (setup) setAuthError(cause instanceof Error ? cause.message : 'Could not save workbook setup.');
      else await reportSyncFailure(cause, true);
    } finally {
      setBusy(false);
    }
  };

  const openDemo = () => {
    try {
      sessionStorage.setItem(DEMO_SESSION, 'true');
    } catch {
      /* Demo still works in memory. */
    }
    setDemo({ id: 'demo', title: 'Fieldwork Supply', data: demoWorkbook() });
    setError('');
    setOpenPages(addScreenTab([], route()));
  };

  const disconnect = async () => {
    flush();
    const id = saved()?.id;
    if (!id || busy() || syncing()) return;
    setBusy(true);
    setAuthError('');
    try {
      await getWorkbookLocks().request(syncLock(id), async () => {
        await removeLocalWorkbook(id);
        clearAccessToken();
        saveSelection();
        setLocal(undefined);
        setSaved(undefined);
        setExpired(false);
        setError('');
        setSyncError('');
      });
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Could not disconnect this workbook.');
    } finally {
      setBusy(false);
    }
  };

  const discardChange = async (id: string) => {
    flush();
    const workbookId = local()?.base.id;
    if (!workbookId || busy() || syncing()) return;
    setBusy(true);
    setError('');
    try {
      await getWorkbookLocks().request(syncLock(workbookId), async () => {
        const next = await updateLocalWorkbook(workbookId, (current) => {
          if (!current) throw new Error('Reconnect the workbook before changing the sync queue.');
          return { ...current, pending: current.pending.filter((item) => item.id !== id || !item.issue) };
        });
        showLocal(next);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not discard the local change.');
    } finally {
      setBusy(false);
    }
  };

  const commit = async (changes: RowChange[], editBase?: WorkbookData | RowChange[]) => {
    flush();
    const current = workbook();
    if (!current || busy()) return false;
    setBusy(true);
    setError('');
    try {
      if (demo()) {
        validateChanges(current.data, changes);
        setDemo({ ...current, data: applyChanges(current.data, changes) });
      } else {
        const next = await updateLocalWorkbook(current.id, (state) => {
          if (!state) throw new Error('Reconnect the workbook before saving changes.');
          return queueLocalChanges(state, changes, editBase ?? current);
        });
        showLocal(next);
      }
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this change on this device.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const leaveDemo = async () => {
    try {
      sessionStorage.removeItem(DEMO_SESSION);
    } catch {
      /* Storage may be unavailable. */
    }
    setDemo(undefined);
    await reset();
    setError('');
  };

  return {
    reconnectContext,
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
    nextSyncAt,
    retryAt,
    needsReconnect,
    connectionBusy,
    issues,
    connect,
    setupSelection,
    setSetupSelection,
    setAuthError,
    openDemo,
    disconnect,
    discardChange,
    commit,
    syncNow,
    changeSyncInterval,
    leaveDemo,
  };
}
