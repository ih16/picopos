import { DEFAULT_SYNC_INTERVAL_SECONDS, syncIntervalSeconds } from '../../domain/sync-timing';

export const SYNC_INTERVAL_KEY = 'piecom.sync-interval';
export const syncAttemptKey = (id: string) => `piecom.sync-attempt:${id}`;

export const syncRetryKey = (id: string) => `piecom.sync-retry:${id}`;

export function readSyncInterval() {
  try {
    return syncIntervalSeconds(localStorage.getItem(SYNC_INTERVAL_KEY));
  } catch {
    return DEFAULT_SYNC_INTERVAL_SECONDS;
  }
}

export function readSyncAttempt(id: string) {
  return readTimestamp(syncAttemptKey(id));
}

export function readSyncRetry(id: string) {
  return readTimestamp(syncRetryKey(id));
}

function readTimestamp(key: string) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function storeSyncTiming(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The open tab can still use its in-memory settings and timing.
  }
}
