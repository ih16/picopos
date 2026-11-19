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
export function syncIntervalSeconds(value: string | null) {
  return SYNC_INTERVALS.some((interval) => interval.value === value)
    ? Number(value)
    : DEFAULT_SYNC_INTERVAL_SECONDS;
}
