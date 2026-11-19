import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { encryptWorkbook, decryptWorkbook } from '../src/infrastructure/storage/workbook-encryption.ts';

const key = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

test('offline encryption round-trips large data and rejects tampering, wrong keys and workbook swaps', async () => {
  const secret = await key();
  const contents = JSON.stringify({
    customer: 'Private customer',
    image: 'a'.repeat(100_000),
    pending: [{ id: 'unsynced' }],
  });
  const encrypted = await encryptWorkbook(contents, 'book', secret);
  assert.ok(!encrypted.includes('Private customer'));
  assert.equal(await decryptWorkbook(encrypted, 'book', secret), contents);
  assert.notEqual(await encryptWorkbook(contents, 'book', secret), encrypted);
  await assert.rejects(decryptWorkbook(encrypted, 'other-book', secret));
  await assert.rejects(decryptWorkbook(encrypted, 'book', await key()));
  const tampered = JSON.parse(encrypted);
  tampered.ciphertext = (tampered.ciphertext[0] === 'A' ? 'B' : 'A') + tampered.ciphertext.slice(1);
  await assert.rejects(decryptWorkbook(JSON.stringify(tampered), 'book', secret));
});

test('legacy offline cache migration preserves queued work, reloads encrypted data, and refuses disconnect', async () => {
  const secret = await key();
  const legacy = {
    version: 1,
    base: { id: 'book', title: 'Shop', data: { Products: [], Customers: [], 'Purchase Lots': [] } },
    pending: [{ id: 'pending', edits: [{ after: { tab: 'Products', row: { id: 'product' } } }] }],
  };
  let disk = JSON.stringify(legacy);
  let failWrite = false;
  const handle = {
    getFile: async () => ({ text: async () => disk }),
    createWritable: async () => {
      let staged = disk;
      return {
        write: async (value: string) => {
          if (failWrite) throw new Error('Disk full');
          staged = value;
        },
        close: async () => {
          disk = staged;
        },
        abort: async () => {},
      };
    },
  };
  const directory = {
    getFileHandle: async () => handle,
    removeEntry: async () => {
      disk = '';
    },
  };
  function load() {
    const exports: any = {};
    const source = readFileSync(
      new URL('../src/infrastructure/storage/local-workbook.ts', import.meta.url),
      'utf8',
    );
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    runInNewContext(outputText, {
      exports,
      DOMException,
      require: (path: string) =>
        path.includes('workbook-encryption')
          ? { encryptWorkbook, decryptWorkbook, workbookEncryptionKey: async () => secret }
          : { HEADERS: { Products: [], Customers: [], 'Purchase Lots': [] } },
      navigator: {
        storage: { getDirectory: async () => ({ getDirectoryHandle: async () => directory }) },
        locks: { request: async (_: string, callback: () => unknown) => callback() },
      },
    });
    return exports;
  }
  failWrite = true;
  await assert.rejects(load().readLocalWorkbook('book'), /Disk full/);
  assert.equal(disk, JSON.stringify(legacy));
  failWrite = false;
  const migrated = await load().readLocalWorkbook('book');
  assert.equal(migrated.pending[0].id, 'pending');
  assert.equal(JSON.parse(disk).encrypted, 1);
  const reloaded = await load().readLocalWorkbook('book');
  assert.equal(JSON.stringify(reloaded), JSON.stringify(legacy));
  await assert.rejects(load().removeLocalWorkbook('book'), /Sync them before disconnecting/);
  const intact = disk;
  disk = disk.replace('"iv":"', '"iv":"corrupt');
  await assert.rejects(load().readLocalWorkbook('book'), /could not be opened/);
  assert.notEqual(disk, intact);
  assert.ok(disk.includes('corrupt'));
});
