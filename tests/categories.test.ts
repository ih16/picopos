import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryPath, emptyWorkbook, validateChanges } from '../src/domain/workbook.ts';

test('category paths support nested categories and legacy roots', () => {
  const categories = [
    { id: 'root', name: 'Shoes' },
    { id: 'baby', name: 'Baby', parentId: 'root' },
    { id: 'boots', name: 'Boots', parentId: 'baby' },
  ];
  assert.deepEqual(
    categoryPath(categories, 'boots').map((row) => row.name),
    ['Shoes', 'Baby', 'Boots'],
  );
  assert.deepEqual(categoryPath(categories, 'missing'), []);
});

test('category changes reject cycles and missing parents but allow moving to root', () => {
  const data = emptyWorkbook();
  data.Categories = [
    { id: 'root', name: 'Shoes' },
    { id: 'baby', name: 'Baby', parentId: 'root' },
  ];
  for (const parentId of ['root', 'baby']) {
    assert.throws(
      () => validateChanges(data, [{ tab: 'Categories', row: { ...data.Categories[0], parentId } }]),
      /own parent/,
    );
  }
  assert.throws(
    () => validateChanges(data, [{ tab: 'Categories', row: { ...data.Categories[1], parentId: 'missing' } }]),
    /existing parent/,
  );
  assert.doesNotThrow(() =>
    validateChanges(data, [{ tab: 'Categories', row: { ...data.Categories[1], parentId: '' } }]),
  );
});
