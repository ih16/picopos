import assert from 'node:assert/strict';
import test from 'node:test';
import { request, SheetsError } from '../src/infrastructure/google/sheets-client.ts';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('Sheets requests encode workbook IDs and send typed JSON without exposing credentials in URLs', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url: URL, options: RequestInit) => {
    assert.equal(url.pathname, '/v4/spreadsheets/book%2Fid:batchUpdate');
    assert.equal(url.search, '');
    assert.equal(options.method, 'POST');
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer token');
    assert.deepEqual(JSON.parse(options.body as string), { requests: [] });
    assert.ok(options.signal);
    return Response.json({ saved: true });
  });
  assert.deepEqual(await request('token', 'book/id', ':batchUpdate', undefined, { requests: [] }), {
    saved: true,
  });
  assert.equal(fetch.mock.callCount(), 1);
});

test('authorization failures are not retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  await assert.rejects(
    request('token', 'book'),
    (cause) => cause instanceof SheetsError && cause.status === 401,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test('transient reads retry with bounded backoff', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    ++calls < 3 ? Response.json({}, { status: 503 }) : Response.json({ title: 'Book' }),
  );
  const result = request('token', 'book');
  await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(1_000);
  await flush();
  assert.equal(calls, 2);
  t.mock.timers.tick(2_000);
  assert.deepEqual(await result, { title: 'Book' });
  assert.equal(calls, 3);
});

test('uncertain writes are never automatically repeated', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Connection lost');
  });
  await assert.rejects(
    request('token', 'book', ':batchUpdate', undefined, { requests: [{}] }),
    /could not be confirmed/,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test('stalled writes abort and release the caller after the request deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    (_url: URL, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      }),
  );
  const rejected = assert.rejects(
    request('token', 'book', ':batchUpdate', undefined, {}),
    /could not be confirmed/,
  );
  t.mock.timers.tick(30_000);
  await rejected;
  assert.equal(fetch.mock.callCount(), 1);
});

test('rate-limited reads stop after three attempts', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 429 }));
  const rejected = assert.rejects(
    request('token', 'book'),
    (cause) => cause instanceof SheetsError && cause.status === 429,
  );
  await flush();
  t.mock.timers.tick(1_000);
  await flush();
  t.mock.timers.tick(2_000);
  await rejected;
  assert.equal(fetch.mock.callCount(), 3);
});
