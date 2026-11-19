import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { HEADERS, emptyWorkbook } from '../src/domain/workbook.ts';

function runtime(
  occupied = false,
  stored?: string,
  categoryOccupied = false,
  lotOccupied = false,
  shippingOccupied = false,
) {
  const rows = new Map<string, unknown[][]>();
  const sheets: {
    properties: { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } };
  }[] = [];
  const labels: Record<string, string> = {
    id: 'ID',
    productId: 'Product ID',
    categoryId: 'Category ID',
    orderId: 'Order ID',
    orderItemId: 'Order Item ID',
    variantId: 'Variant ID',
    sku: 'SKU',
    number: 'Order Number',
    onHandDelta: 'On Hand Change',
    unavailableDelta: 'Unavailable Change',
  };
  for (const [name, fields] of Object.entries(HEADERS)) {
    if (name === 'Customers' || name === 'Purchase Lots') continue;
    rows.set(name, [
      fields
        .filter(
          (field) =>
            field !== 'shippingOption' &&
            field !== 'customerId' &&
            field !== 'parentId' &&
            field !== 'purchaseLotId',
        )
        .map(
          (field) => labels[field] ?? field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        ),
    ]);
  }
  rows.get('Settings')!.push(['schemaVersion', '1']);
  rows.set('Inventory', [
    ['Variant ID', 'SKU', 'Product', 'Options', 'On Hand', 'Reserved', 'Unavailable', 'Available'],
  ]);
  for (const title of rows.keys())
    sheets.push({
      properties: { sheetId: sheets.length + 1, title, gridProperties: { rowCount: 100, columnCount: 26 } },
    });
  const writes: any[] = [];
  const modules = new Map<string, any>();
  const aliases: Record<string, string> = {
    sheets: 'infrastructure/google/sheets',
    'local-workbook': 'infrastructure/storage/local-workbook',
  };
  const load = (input: string): any => {
    const name = input.startsWith('/')
      ? input
      : fileURLToPath(new URL(`../src/${aliases[input] ?? input}.ts`, import.meta.url));
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    modules.set(name, exports);
    const source = readFileSync(name, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    runInNewContext(outputText, {
      exports,
      require: (path: string) =>
        path.endsWith('workbook-encryption')
          ? { workbookEncryptionKey: async () => ({}), encryptWorkbook: async (contents: string) => contents }
          : load(resolve(dirname(name), path.endsWith('.ts') ? path : `${path}.ts`)),
      URL,
      URLSearchParams,
      TextEncoder,
      crypto,
      AbortController,
      setTimeout,
      clearTimeout,
      navigator: {
        locks: { request: (_name: string, callback: () => unknown) => callback() },
        storage: {
          getDirectory: async () => ({
            getDirectoryHandle: async () => ({
              getFileHandle: async () => ({
                getFile: async () => ({ text: async () => stored }),
                createWritable: async () => ({
                  write: async (contents: string) => {
                    stored = contents;
                  },
                  close: async () => {},
                  abort: async () => {},
                }),
              }),
            }),
          }),
        },
      },
      fetch: async (url: URL, options: RequestInit) => {
        let result: unknown;
        if (url.pathname.endsWith('/values:batchGet')) {
          result = {
            valueRanges: url.searchParams.getAll('ranges').map((range) => ({
              values:
                range === "'Orders'!M:M"
                  ? shippingOccupied
                    ? [['=custom_formula()']]
                    : []
                  : range === "'Stock Entries'!H:H"
                    ? lotOccupied
                      ? [['=custom_formula()']]
                      : []
                    : range === "'Orders'!L:L"
                      ? occupied
                        ? [['=custom_formula()']]
                        : []
                      : range === "'Categories'!C:C"
                        ? categoryOccupied
                          ? [['=custom_formula()']]
                          : []
                        : (rows.get(range.split("'")[1]) ?? []),
            })),
          };
        } else if (url.pathname.endsWith(':batchUpdate')) {
          const requests = JSON.parse(options.body as string).requests;
          writes.push(...requests);
          for (const request of requests) {
            if (request.addSheet) {
              sheets.push({ properties: request.addSheet.properties });
              rows.set(request.addSheet.properties.title, []);
            }
            if (request.updateCells) {
              const update = request.updateCells;
              const sheet = sheets.find((sheet) => sheet.properties.sheetId === update.start.sheetId)!;
              const data = rows.get(sheet.properties.title)!;
              update.rows.forEach((row: any, offset: number) => {
                const index = update.start.rowIndex + offset;
                data[index] ??= [];
                row.values.forEach((cell: any, column: number) => {
                  data[index][update.start.columnIndex + column] = cell.userEnteredValue?.stringValue ?? '';
                });
              });
            }
          }
          result = {};
        } else result = { spreadsheetId: 'book', properties: { title: 'Book' }, sheets };
        return { ok: true, json: async () => result };
      },
    });
    return exports;
  };
  return { load, writes, rows };
}

test('sync upgrades an existing workbook without reconnect and migration is idempotent', async () => {
  const { load, writes, rows } = runtime();
  const sheets = load('sheets');
  const result = await sheets.syncWorkbookBatch('token', 'book', []);
  assert.equal(result.base.data.Customers.length, 0);
  assert.equal(result.base.data['Purchase Lots'].length, 0);
  assert.equal(rows.get('Stock Entries')![0][7], 'Purchase Lot ID');
  assert.equal(rows.get('Orders')![0][11], 'Customer ID');
  assert.equal(rows.get('Orders')![0][12], 'Shipping Option');
  assert.equal(rows.get('Categories')![0][2], 'Parent Category ID');
  assert.equal(writes.filter((request) => request.addSheet).length, 2);
  const count = writes.length;
  await sheets.syncWorkbookBatch('token', 'book', []);
  assert.equal(writes.length, count);
});

test('migration never overwrites a formula in the new order-link column', async () => {
  const { load, writes } = runtime(true);
  await assert.rejects(
    load('sheets').syncWorkbookBatch('token', 'book', []),
    /column L contains existing data/,
  );
  assert.equal(writes.length, 0);
});

test('old offline workbooks gain an empty directory without dropping pending changes', async () => {
  const data: any = emptyWorkbook();
  delete data.Customers;
  delete data['Purchase Lots'];
  const pending = [
    { id: 'queued', edits: [{ after: { tab: 'Categories', row: { id: 'c', name: 'Saved offline' } } }] },
  ];
  const stored = JSON.stringify({ version: 1, base: { id: 'book', title: 'Book', data }, pending });
  const result = await runtime(false, stored).load('local-workbook').readLocalWorkbook('book');
  assert.equal(result.base.data.Customers.length, 0);
  assert.equal(result.base.data['Purchase Lots'].length, 0);
  assert.equal(JSON.stringify(result.pending), JSON.stringify(pending));
});

test('migration never overwrites a formula in the category parent column', async () => {
  const { load, writes } = runtime(false, undefined, true);
  await assert.rejects(
    load('sheets').syncWorkbookBatch('token', 'book', []),
    /Categories column C contains existing data/,
  );
  assert.equal(writes.length, 0);
});

test('migration never overwrites a formula in the purchase lot reference column', async () => {
  const { load, writes } = runtime(false, undefined, false, true);
  await assert.rejects(
    load('sheets').syncWorkbookBatch('token', 'book', []),
    /Stock Entries column H contains existing data/,
  );
  assert.equal(writes.length, 0);
});

test('migration never overwrites a formula in the shipping option column', async () => {
  const { load, writes } = runtime(false, undefined, false, false, true);
  await assert.rejects(
    load('sheets').syncWorkbookBatch('token', 'book', []),
    /Orders column M contains existing data/,
  );
  assert.equal(writes.length, 0);
});

test('workbook setup waits for confirmation, writes preferences, and preserves recognized settings', async () => {
  const { load, writes, rows } = runtime();
  const sheets = load('sheets');
  rows.get('Settings')!.splice(1);
  assert.equal(await sheets.initializeWorkbook('token', 'book'), undefined);
  assert.equal(writes.length, 0);

  const shipping = JSON.stringify([{ id: 'pickup', name: 'Pickup', rate: 0 }]);
  await assert.rejects(
    sheets.initializeWorkbook('token', 'book', [
      { tab: 'Settings', row: { id: 'shippingOptions', value: 'invalid' } },
    ]),
    /valid list/,
  );
  assert.equal(writes.length, 0);
  await sheets.initializeWorkbook('token', 'book', [
    { tab: 'Settings', row: { id: 'currency', value: 'BDT' } },
    { tab: 'Settings', row: { id: 'shippingOptions', value: shipping } },
  ]);
  assert.equal(rows.get('Settings')!.find(([id]) => id === 'currency')?.[1], 'BDT');
  assert.equal(rows.get('Settings')!.find(([id]) => id === 'shippingOptions')?.[1], shipping);
  writes.length = 0;
  await sheets.initializeWorkbook('token', 'book', [
    { tab: 'Settings', row: { id: 'currency', value: 'USD' } },
  ]);
  assert.equal(writes.length, 0);
  assert.equal(rows.get('Settings')!.find(([id]) => id === 'currency')?.[1], 'BDT');
});
