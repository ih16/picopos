import assert from 'node:assert/strict';
import test from 'node:test';
import { syncWorkbookQueue } from '../src/app/sync-workbook-queue.ts';
import type { LocalWorkbook, PendingChange } from '../src/domain/outbox.ts';
import { emptyWorkbook } from '../src/domain/workbook.ts';

const book = { id: 'book', title: 'Shop', data: emptyWorkbook() };

function categoryEdit(id: string): PendingChange {
  return { id, edits: [{ after: { tab: 'Categories', row: { id, name: id } } }] };
}

test('sync drains the captured queue and preserves changes saved during a batch', async () => {
  const first = categoryEdit('first');
  const delayed = categoryEdit('delayed');
  const concurrent = categoryEdit('concurrent');
  let stored: LocalWorkbook = { version: 1, base: book, pending: [first, delayed], revision: 3 };
  const seen: string[][] = [];
  const snapshots: string[][] = [];

  await syncWorkbookQueue({
    pending: stored.pending,
    syncBatch: async (pending) => {
      seen.push(pending.map(({ id }) => id));
      if (seen.length === 1) {
        stored = { ...stored, pending: [...stored.pending, concurrent], revision: 4 };
        return { base: book, acknowledged: [first.id], blocked: {}, remaining: true };
      }
      return { base: book, acknowledged: [], blocked: { delayed: 'Check this edit' }, remaining: true };
    },
    updateLocal: async (update) => {
      stored = update(stored);
      return stored;
    },
    onSnapshot: (state) => {
      snapshots.push(state.pending.map(({ id }) => id));
    },
  });

  assert.deepEqual(seen, [['first', 'delayed'], ['delayed']]);
  assert.deepEqual(snapshots, [
    ['delayed', 'concurrent'],
    ['delayed', 'concurrent'],
  ]);
  assert.deepEqual(stored.pending, [{ ...delayed, issue: 'Check this edit' }, concurrent]);
  assert.equal(stored.revision, 4);
});

test('sync leaves the outbox untouched when the batch cannot confirm its writes', async () => {
  await assert.rejects(
    syncWorkbookQueue({
      pending: [categoryEdit('queued')],
      syncBatch: async () => {
        throw new Error('Readback failed');
      },
      updateLocal: () => assert.fail('Do not reconcile an unconfirmed result'),
      onSnapshot: () => assert.fail('Do not publish an unconfirmed result'),
    }),
    /Readback failed/,
  );
});

test('a rate limit mid-sync retains the unconfirmed batch for the next sync', async () => {
  const first = categoryEdit('first');
  const second = categoryEdit('second');
  let stored: LocalWorkbook = { version: 1, base: book, pending: [first, second] };
  const updateLocal = async (update: (latest: LocalWorkbook | undefined) => LocalWorkbook) =>
    (stored = update(stored));
  const onSnapshot = () => {};
  await assert.rejects(
    syncWorkbookQueue({
      pending: stored.pending,
      updateLocal,
      onSnapshot,
      syncBatch: async (pending) => {
        if (pending.length === 1) throw new Error('quota reached');
        return { base: book, acknowledged: [first.id], blocked: {}, remaining: true };
      },
    }),
    /quota reached/,
  );
  assert.deepEqual(
    stored.pending.map((edit) => edit.id),
    [second.id],
  );
  await syncWorkbookQueue({
    pending: stored.pending,
    updateLocal,
    onSnapshot,
    syncBatch: async (pending) => {
      assert.deepEqual(
        pending.map((edit) => edit.id),
        [second.id],
      );
      return { base: book, acknowledged: [second.id], blocked: {}, remaining: false };
    },
  });
  assert.deepEqual(stored.pending, []);
});
