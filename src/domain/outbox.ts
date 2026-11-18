import {
  applyChanges,
  HEADERS,
  makeId,
  validateChanges,
  type RowChange,
  type TableName,
  type Workbook,
  type WorkbookData,
} from './workbook';

export type PendingEdit = { before?: RowChange; after: RowChange };

export type PendingChange = {
  id: string;
  edits: PendingEdit[];
  issue?: string;
};

export type LocalWorkbook = {
  version: 1;
  base: Workbook;
  pending: PendingChange[];
  lastSyncedAt?: number;
  revision?: number;
};

export function findRowChange(data: WorkbookData, tab: TableName, id: string): RowChange | undefined {
  const row = data[tab].find((candidate) => candidate.id === id);
  return row ? ({ tab, row } as RowChange) : undefined;
}

export function pendingEditFields({ before, after }: PendingEdit): string[] {
  const values = after.row as Record<string, unknown>;
  const original = before?.row as Record<string, unknown> | undefined;
  return HEADERS[after.tab].filter(
    (field) =>
      field !== 'id' &&
      values[field] !== undefined &&
      values[field] !== (field === 'image' ? (original?.[field] ?? '') : original?.[field]),
  );
}

function applyPendingEdit(current: RowChange | undefined, edit: PendingEdit): RowChange | undefined {
  if (!current) return edit.before ? undefined : edit.after;
  const incoming = edit.after.row as Record<string, unknown>;
  const fields = pendingEditFields(edit);
  return {
    ...current,
    row: { ...current.row, ...Object.fromEntries(fields.map((field) => [field, incoming[field]])) },
  } as RowChange;
}

export function mergePendingEdits(data: WorkbookData, edits: PendingEdit[]): RowChange[] {
  const changes: RowChange[] = [];
  const seen = new Set<string>();
  for (const edit of edits) {
    const { tab, row } = edit.after;
    const key = `${tab}:${row.id}`;
    if (seen.has(key)) throw new Error(`Multiple edits to "${row.id}" in "${tab}".`);
    seen.add(key);
    const current = findRowChange(data, tab, row.id);
    const result = applyPendingEdit(current, edit);
    if (!result) {
      throw new Error(`${tab} record ${row.id} was removed from the workbook.`);
    }
    const incoming = result.row as Record<string, unknown>;
    const existing = current?.row as Record<string, unknown> | undefined;
    const hasChanges =
      !current ||
      pendingEditFields(edit).some(
        (field) => incoming[field] !== (field === 'image' ? (existing?.[field] ?? '') : existing?.[field]),
      );
    if (!edit.before && current && hasChanges) {
      throw new Error(`${tab} record ${row.id} already exists.`);
    }
    if (hasChanges) changes.push(result);
  }
  return changes;
}

export function projectLocalWorkbook(state: LocalWorkbook): Workbook {
  let data = state.base.data;
  for (const { edits, issue } of state.pending) {
    if (issue) continue;
    try {
      const changes = mergePendingEdits(data, edits);
      validateChanges(data, changes);
      data = applyChanges(data, changes);
    } catch {
      // Sync keeps invalid groups queued and records why it could not apply them.
    }
  }
  return { ...state.base, data };
}

export function queueLocalChanges(
  state: LocalWorkbook,
  changes: RowChange[],
  editedWorkbook?: Workbook | WorkbookData | RowChange[],
): LocalWorkbook {
  const current = projectLocalWorkbook(state).data;
  const baseline = !editedWorkbook
    ? current
    : 'data' in editedWorkbook
      ? editedWorkbook.data
      : editedWorkbook;
  const edits = changes
    .map((after): PendingEdit => ({
      before: Array.isArray(baseline)
        ? baseline.find((change) => change.tab === after.tab && change.row.id === after.row.id)
        : findRowChange(baseline, after.tab, after.row.id),
      after,
    }))
    .filter((edit) => !edit.before || pendingEditFields(edit).length > 0);
  if (!edits.length) return state;

  validateChanges(current, mergePendingEdits(current, edits));
  return { ...state, pending: [...state.pending, { id: makeId(), edits }] };
}
