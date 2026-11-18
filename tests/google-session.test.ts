import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function googleSession(stored = new Map<string, string>(), key?: CryptoKey) {
  let now = 1_000;
  const legacy = new Map<string, string>();
  const listeners = new Set<(event: unknown) => void>();
  const storage = {
    getItem: (name: string) => stored.get(name) ?? null,
    setItem: (name: string, value: string) => stored.set(name, value),
    removeItem: (name: string) => stored.delete(name),
  };
  const source = readFileSync(
    new URL('../src/infrastructure/google/google.ts', import.meta.url),
    'utf8',
  ).replaceAll('import.meta.env', '({ VITE_GOOGLE_CLIENT_ID: "test-client" })');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports: {
    requestGoogleAccess: () => Promise<string>;
    getAccessToken: (allowExpired?: boolean) => string | undefined;
    clearAccessToken: () => void;
    rememberAccessToken: (id: string) => Promise<void>;
    restoreAccessToken: (id: string, allowExpired?: boolean) => Promise<boolean>;
    watchAccessToken: (id: string, callback: (authorized: boolean) => void) => () => void;
  } = {} as never;
  runInNewContext(outputText, {
    exports,
    TextEncoder,
    TextDecoder,
    Date: { now: () => now },
    window: {
      localStorage: storage,
      sessionStorage: {
        getItem: (name: string) => legacy.get(name) ?? null,
        removeItem: (name: string) => legacy.delete(name),
      },
      addEventListener: (_: string, listener: (event: unknown) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: unknown) => void) => listeners.delete(listener),
      crypto: webcrypto,
      btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
      atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
      indexedDB: {
        open: () => {
          const request: any = {
            result: {
              close() {},
              transaction: () => {
                const transaction: any = {
                  objectStore: () => ({
                    get: () => {
                      const read: any = { result: key };
                      queueMicrotask(() => {
                        read.onsuccess();
                        transaction.oncomplete();
                      });
                      return read;
                    },
                  }),
                };
                return transaction;
              },
            },
          };
          queueMicrotask(() => request.onsuccess());
          return request;
        },
      },
      google: {
        accounts: {
          oauth2: {
            initTokenClient: ({ callback }: { callback: (response: unknown) => void }) => ({
              requestAccessToken: () =>
                callback({
                  access_token: 'test-token',
                  expires_in: 60,
                  scope: 'https://www.googleapis.com/auth/drive.file',
                }),
            }),
          },
        },
      },
    },
  });
  return {
    api: exports,
    stored,
    legacy,
    notify: () =>
      listeners.forEach((listener) => listener({ storageArea: storage, key: 'piecom-google-session' })),
    expire: () => {
      now += 60_000;
    },
  };
}

test('sync can try a locally expired token without making it available to ordinary authorization', async () => {
  const { api, expire, stored } = googleSession();
  await api.requestGoogleAccess();
  assert.equal(api.getAccessToken(), 'test-token');
  stored.set('piecom-google-session', 'saved-session');
  expire();
  assert.equal(api.getAccessToken(), undefined);
  assert.equal(api.getAccessToken(true), 'test-token');
  assert.equal(stored.get('piecom-google-session'), 'saved-session');
});

test('a rejected session remains cleared even when sync requests an expired token', async () => {
  const { api, stored } = googleSession();
  await api.requestGoogleAccess();
  stored.set('piecom-google-session', 'saved-session');
  api.clearAccessToken();
  assert.equal(api.getAccessToken(true), undefined);
  assert.equal(stored.has('piecom-google-session'), false);
});

async function sharedSessions() {
  const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const stored = new Map<string, string>();
  return [googleSession(stored, key), googleSession(stored, key)];
}

test('a new tab restores encrypted authorization from the shared session', async () => {
  const [first, second] = await sharedSessions();
  await first.api.requestGoogleAccess();
  await first.api.rememberAccessToken('workbook');
  assert.equal(first.stored.get('piecom-google-session')?.includes('test-token'), false);
  assert.equal(await second.api.restoreAccessToken('other-workbook'), false);
  assert.equal(await second.api.restoreAccessToken('workbook'), true);
  assert.equal(second.api.getAccessToken(), 'test-token');
});

test('open tabs receive reconnect and disconnect changes', async () => {
  const [first, second] = await sharedSessions();
  await first.api.requestGoogleAccess();
  await first.api.rememberAccessToken('workbook');
  await new Promise<void>((resolve) => {
    const stop = second.api.watchAccessToken('workbook', (authorized) => {
      assert.equal(authorized, true);
      assert.equal(second.api.getAccessToken(), 'test-token');
      stop();
      resolve();
    });
    second.notify();
  });
  first.api.clearAccessToken();
  await new Promise<void>((resolve) => {
    const stop = second.api.watchAccessToken('workbook', (authorized) => {
      assert.equal(authorized, false);
      assert.equal(second.api.getAccessToken(true), undefined);
      stop();
      resolve();
    });
    second.notify();
  });
});

test('an existing tab migrates its encrypted session', async () => {
  const [first] = await sharedSessions();
  await first.api.requestGoogleAccess();
  await first.api.rememberAccessToken('workbook');
  const saved = first.stored.get('piecom-google-session')!;
  first.api.clearAccessToken();
  first.legacy.set('piecom-google-session', saved);
  assert.equal(await first.api.restoreAccessToken('workbook'), true);
  assert.equal(first.legacy.size, 0);
  assert.equal(first.stored.get('piecom-google-session'), saved);
});
