import assert from 'node:assert/strict';
import test from 'node:test';
import { virtualWindow } from '../src/shared/lib/virtual-window.ts';

test('virtual window bounds rendered rows and preserves total height across scrolling', () => {
  const heights = Array.from({ length: 1000 }, (_, index) => (index % 2 ? 140 : 60));
  for (const top of [0, 1000, 50000, 99500]) {
    const result = virtualWindow(heights, top, 500);
    assert.ok(result.end - result.start <= 17);
    assert.equal(
      result.before + heights.slice(result.start, result.end).reduce((a, b) => a + b, 0) + result.after,
      100000,
    );
  }
  assert.equal(virtualWindow(heights, 99500, 500).end, 1000);
});

test('virtual window handles empty and short filtered lists', () => {
  assert.deepEqual(virtualWindow([], 0, 800), { start: 0, end: 0, before: 0, after: 0 });
  assert.deepEqual(virtualWindow([60, 120], 0, 800), { start: 0, end: 2, before: 0, after: 0 });
});
