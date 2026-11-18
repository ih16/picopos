export const SYNC_INTERVALS = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: '3600', label: '1 hour' },
] as const;

export const DEFAULT_SYNC_INTERVAL_SECONDS = Number(SYNC_INTERVALS[0].value);
export const SYNC_INTERVAL_KEY = 'piecom.sync-interval';
export const syncAttemptKey = (id: string) => `piecom.sync-attempt:${id}`;

export function syncIntervalSeconds(value: string | null) {
  return SYNC_INTERVALS.some((interval) => interval.value === value)
    ? Number(value)
    : DEFAULT_SYNC_INTERVAL_SECONDS;
}

export function readSyncInterval() {
  try {
    return syncIntervalSeconds(localStorage.getItem(SYNC_INTERVAL_KEY));
  } catch {
    return DEFAULT_SYNC_INTERVAL_SECONDS;
  }
}

export function readSyncAttempt(id: string) {
  try {
    const value = Number(localStorage.getItem(syncAttemptKey(id)));
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
