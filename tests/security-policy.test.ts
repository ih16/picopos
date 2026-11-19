import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { secureHtml } from '../scripts/secure-html.mjs';

test('static CSP hashes application scripts without allowing injected scripts or handlers', () => {
  const script = 'window.test = 1;';
  const html = secureHtml(`<html><head><script>${script}</script></head><body></body></html>`);
  const hash = createHash('sha256').update(script).digest('base64');
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script>'));
  assert.ok(html.includes(`'sha256-${hash}'`));
  const scriptPolicy = html.match(/script-src ([^;]+)/)![1];
  assert.ok(!scriptPolicy.includes('unsafe-inline'));
  assert.ok(!scriptPolicy.includes('unsafe-eval'));
  assert.ok(html.includes("script-src-attr 'none'"));
  assert.ok(html.includes('https://accounts.google.com/gsi/client'));
  assert.ok(html.includes('https://sheets.googleapis.com'));
  assert.ok(html.includes('https://docs.google.com'));
  assert.ok(html.includes("worker-src 'self'"));
});
