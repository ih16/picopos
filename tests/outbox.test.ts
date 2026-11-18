import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as workbook from '../src/domain/workbook.ts';
import type * as Outbox from '../src/domain/outbox.ts';

const api = {} as typeof Outbox;
const source = readFileSync(new URL('../src/domain/outbox.ts', import.meta.url), 'utf8');
runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: api, require: () => workbook, crypto },
);

function fixture(): Outbox.LocalWorkbook {
  return {
    version: 1,
    base: {
      id: 'book',
      title: 'Shop',
      data: {
        ...workbook.emptyWorkbook(),
        Customers: [
          {
            id: 'customer',
            name: 'Sam',
            contact: 'old phone',
            address: 'Old street',
            notes: '',
            active: true,
          },
        ],
      },
    },
    pending: [],
  };
}

test('queued edits preserve fresh changes to unrelated fields while local edits win conflicts', () => {
  const initial = fixture();
  const original = initial.base.data.Customers[0];
  const queued = api.queueLocalChanges(
    initial,
    [{ tab: 'Customers', row: { ...original, contact: 'local phone' } }],
    initial.base,
  );
  const remote = {
    ...queued,
    base: {
      ...queued.base,
      data: {
        ...queued.base.data,
        Customers: [{ ...original, contact: 'remote phone', address: 'New street' }],
      },
    },
  };
  const projected = api.projectLocalWorkbook(remote);
  assert.equal(projected.data.Customers[0].contact, 'local phone');
  assert.equal(projected.data.Customers[0].address, 'New street');
  assert.equal(initial.base.data.Customers[0].contact, 'old phone');
});

test('no-op edits do not grow the outbox and already-applied writes reconcile without duplication', () => {
  const state = fixture();
  const row = state.base.data.Customers[0];
  assert.equal(api.queueLocalChanges(state, [{ tab: 'Customers', row }]), state);
  const added: workbook.RowChange = { tab: 'Categories', row: { id: 'category', name: 'Shoes' } };
  const queued = api.queueLocalChanges(state, [added]);
  const applied = workbook.applyChanges(state.base.data, [added]);
  assert.equal(api.mergePendingEdits(applied, queued.pending[0].edits).length, 0);
});

test('deleted or conflicting records remain blocked instead of being recreated or overwritten', () => {
  const state = fixture();
  const row = state.base.data.Customers[0];
  const queued = api.queueLocalChanges(state, [{ tab: 'Customers', row: { ...row, name: 'New name' } }]);
  assert.throws(
    () => api.mergePendingEdits(workbook.emptyWorkbook(), queued.pending[0].edits),
    /removed from the workbook/,
  );
  assert.throws(
    () =>
      api.mergePendingEdits(state.base.data, [
        { after: { tab: 'Customers', row: { ...row, name: 'Collision' } } },
      ]),
    /already exists/,
  );
});

test('blocked groups stay queued and are omitted from the visible workbook', () => {
  const state = fixture();
  const queued = api.queueLocalChanges(state, [
    { tab: 'Customers', row: { ...state.base.data.Customers[0], name: 'Pending name' } },
  ]);
  queued.pending[0].issue = 'Needs attention';
  assert.equal(api.projectLocalWorkbook(queued).data.Customers[0].name, 'Sam');
  assert.equal(queued.pending.length, 1);
});
