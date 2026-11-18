import type { LocalWorkbook, PendingChange } from '../../domain/outbox';
import { HEADERS, type RowChange, type TableName } from '../../domain/workbook';

const storageDirectory = 'piecom-workbooks';
const tabs = Object.keys(HEADERS) as TableName[];

const fileName = (id: string) => `${encodeURIComponent(id)}.json`;
const lockName = (id: string) => `piecom:local-workbook:${id}`;
const channelName = (id: string) => `piecom:workbook-updated:${id}`;

export function getWorkbookLocks(): LockManager {
  if (!navigator.storage?.getDirectory || !navigator.locks) {
    throw new Error('This browser cannot save picopos workbooks on this device.');
  }
  return navigator.locks;
}

async function workbookDirectory(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(storageDirectory, { create });
}

function hasName(cause: unknown, name: string): boolean {
  return cause instanceof DOMException && cause.name === name;
}

function isStoredChange(value: unknown): value is RowChange {
  const change = value as Partial<RowChange> | null;
  return Boolean(change?.tab && Object.hasOwn(HEADERS, change.tab) && typeof change.row?.id === 'string');
}

function isPendingChange(value: unknown): value is PendingChange {
  const operation = value as Partial<PendingChange> | null;
  if (
    !operation?.id ||
    typeof operation.id !== 'string' ||
    !Array.isArray(operation.edits) ||
    !operation.edits.length ||
    (operation.issue !== undefined && typeof operation.issue !== 'string')
  )
    return false;
  return operation.edits.every(
    (edit) =>
      isStoredChange(edit?.after) &&
      (edit.before === undefined ||
        (isStoredChange(edit.before) &&
          edit.before.tab === edit.after.tab &&
          edit.before.row.id === edit.after.row.id)),
  );
}

function decodeLocalWorkbook(contents: string, id: string): LocalWorkbook {
  try {
    const state = JSON.parse(contents) as Partial<LocalWorkbook> | null;
    // Older local snapshots predate the directory; retain their queued edits intact.
    if (state?.base?.data && !Object.hasOwn(state.base.data, 'Customers')) state.base.data.Customers = [];
    if (state?.base?.data && !Object.hasOwn(state.base.data, 'Purchase Lots'))
      state.base.data['Purchase Lots'] = [];
    if (
      state?.version === 1 &&
      state.base?.id === id &&
      typeof state.base.title === 'string' &&
      state.base.data &&
      tabs.every((tab) => Array.isArray(state.base?.data[tab])) &&
      (state.revision === undefined || (Number.isSafeInteger(state.revision) && state.revision >= 1)) &&
      (state.lastSyncedAt === undefined || Number.isFinite(state.lastSyncedAt)) &&
      Array.isArray(state.pending) &&
      state.pending.every(isPendingChange)
    ) {
      return state as LocalWorkbook;
    }
  } catch {
    // Preserve an unreadable file so a later attempt cannot overwrite its pending edits.
  }
  throw new Error('The saved workbook on this device could not be read.');
}

async function readStoredWorkbook(id: string): Promise<LocalWorkbook | undefined> {
  let handle: FileSystemFileHandle;
  try {
    const directory = await workbookDirectory(false);
    handle = await directory.getFileHandle(fileName(id));
  } catch (cause) {
    if (hasName(cause, 'NotFoundError')) return undefined;
    throw cause;
  }
  const contents = await (await handle.getFile()).text();
  // The first write can leave an empty file if interrupted before close().
  return contents ? decodeLocalWorkbook(contents, id) : undefined;
}

export async function readLocalWorkbook(id: string): Promise<LocalWorkbook | undefined> {
  return getWorkbookLocks().request(lockName(id), { mode: 'shared' }, () => readStoredWorkbook(id));
}

async function writeStoredWorkbook(id: string, state: LocalWorkbook): Promise<void> {
  const contents = JSON.stringify(state);
  let writable: FileSystemWritableFileStream | undefined;
  try {
    const directory = await workbookDirectory(true);
    const handle = await directory.getFileHandle(fileName(id), { create: true });
    if (typeof handle.createWritable !== 'function') {
      throw new Error('This browser cannot save picopos workbooks on this device.');
    }
    writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
  } catch (cause) {
    await writable?.abort().catch(() => {});
    if (hasName(cause, 'QuotaExceededError')) {
      throw new Error(
        'This device ran out of space for the workbook. Free up browser storage and try again.',
      );
    }
    if (hasName(cause, 'NotAllowedError') || hasName(cause, 'SecurityError')) {
      throw new Error('This browser blocked picopos from saving the workbook on this device.');
    }
    throw cause;
  }
}

function notifyLocalWorkbook(id: string) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(channelName(id));
    try {
      channel.postMessage('changed');
    } finally {
      channel.close();
    }
  } catch {
    // A notification cannot change the result of a completed write.
  }
}

export async function updateLocalWorkbook(
  id: string,
  update: (current: LocalWorkbook | undefined) => LocalWorkbook,
): Promise<LocalWorkbook> {
  return getWorkbookLocks().request(lockName(id), async () => {
    const current = await readStoredWorkbook(id);
    const updated = update(current);
    if (updated === current) return current;
    if (updated.base.id !== id)
      throw new Error('The local workbook does not match the selected spreadsheet.');
    const next = { ...updated, revision: (current?.revision ?? 0) + 1 };
    await writeStoredWorkbook(id, next);
    notifyLocalWorkbook(id);
    return next;
  });
}

export async function removeLocalWorkbook(id: string): Promise<void> {
  await getWorkbookLocks().request(lockName(id), async () => {
    const current = await readStoredWorkbook(id);
    if (current?.pending.length) {
      throw new Error('This workbook has changes saved on this device. Sync them before disconnecting.');
    }
    try {
      const directory = await workbookDirectory(false);
      await directory.removeEntry(fileName(id));
    } catch (cause) {
      if (!hasName(cause, 'NotFoundError')) throw cause;
    }
    notifyLocalWorkbook(id);
  });
}

export function watchLocalWorkbook(id: string, changed: () => void): () => void {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(channelName(id));
      channel.onmessage = changed;
      return () => channel.close();
    } catch {
      // The next refresh still reads the device state.
    }
  }
  return () => {};
}
