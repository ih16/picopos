import type { LocalWorkbook, PendingChange } from '../domain/outbox';
import type { syncWorkbookBatch } from '../infrastructure/google/sheets';

type BatchResult = Awaited<ReturnType<typeof syncWorkbookBatch>>;

type SyncQueueOptions = {
  pending: readonly PendingChange[];
  syncBatch: (pending: readonly PendingChange[]) => Promise<BatchResult>;
  updateLocal: (update: (latest: LocalWorkbook | undefined) => LocalWorkbook) => Promise<LocalWorkbook>;
  onSnapshot: (state: LocalWorkbook) => void | Promise<void>;
};

/** Run under the workbook's sync lock. Local edits can still acquire the separate write lock. */
export async function syncWorkbookQueue({ pending, syncBatch, updateLocal, onSnapshot }: SyncQueueOptions) {
  let remaining = pending;
  while (true) {
    const result = await syncBatch(remaining);
    const acknowledged = new Set(result.acknowledged);
    const attempted = new Set(remaining.map(({ id }) => id));
    const state = await updateLocal((latest) => ({
      ...latest,
      version: 1,
      base: result.base,
      lastSyncedAt: Date.now(),
      pending: (latest?.pending ?? [])
        .filter(({ id }) => !acknowledged.has(id))
        .map((item) => (attempted.has(item.id) ? { ...item, issue: result.blocked[item.id] } : item)),
    }));
    await onSnapshot(state);
    if (!result.remaining || !acknowledged.size) return;
    // Continue with the captured queue. Edits saved during this sync belong to the next run.
    remaining = remaining.filter(({ id }) => !acknowledged.has(id));
  }
}
