import assert from 'node:assert/strict';
import test from 'node:test';
import { BAND_HEIGHT, PAGE_SIZE, pageLayout } from '../src/shared/lib/page-layout.ts';

test('scroll bands include every intersecting page, including measured and partial pages', () => {
  const { starts, bands } = pageLayout(2 * PAGE_SIZE + 3, 60, { 0: 500, 1: 150 });
  assert.deepEqual(starts, [0, 500, 650, 830]);
  for (let offset = 0; offset < 830; offset++) {
    const page = starts.findIndex((end) => end > offset) - 1;
    const band = bands[Math.floor(offset / BAND_HEIGHT)];
    assert.ok(band.first <= page && page <= band.last);
  }
});
test('empty and exact-boundary lists have no phantom pages', () => {
  assert.deepEqual(pageLayout(0, 40, {}), { starts: [0], bands: [] });
  assert.deepEqual(pageLayout(PAGE_SIZE, 40, { 0: BAND_HEIGHT }).bands, [{ first: 0, last: 0 }]);
});
