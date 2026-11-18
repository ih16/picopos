import assert from 'node:assert/strict';
import test from 'node:test';
import { orderPath, parseScreenRoute } from '../src/app/navigation/screen-route.ts';

test('screen links restore each workspace destination', () => {
  for (const [path, page] of [
    ['/orders', 'Orders'],
    ['/catalog', 'Catalog'],
    ['/customers', 'Customers'],
    ['/inventory', 'Inventory'],
    ['/settings', 'Connection'],
  ]) {
    const route = parseScreenRoute(`#${path}`);
    assert.equal(route.page, page);
    assert.equal(route.path, path);
  }
  assert.equal(parseScreenRoute('#/catalog/categories').catalogPage, 'categories');
  assert.equal(parseScreenRoute('#/orders/new').creating, true);
  assert.equal(parseScreenRoute('#/orders/new').orderId, '');
});

test('order links round-trip IDs without treating their contents as routes', () => {
  for (const id of ['order-123', 'order/with space?#%', 'অর্ডার']) {
    const route = parseScreenRoute(`#${orderPath(id)}`);
    assert.equal(route.orderId, id);
    assert.equal(route.page, 'Orders');
    assert.equal(route.creating, false);
    assert.equal(route.path, orderPath(id));
  }
});

test('empty, unknown and malformed routes have a safe canonical destination', () => {
  for (const path of ['', '#', '#/', '#/missing', '#/orders/%', '#/orders/a/b']) {
    assert.equal(parseScreenRoute(path).path, '/orders');
  }
  assert.equal(parseScreenRoute('#/catalog/categories/').path, '/catalog/categories');
});

test('inventory tabs restore their own routes', () => {
  for (const [path, inventoryPage] of [
    ['/inventory', 'stock'],
    ['/inventory/entries', 'entries'],
    ['/inventory/lots', 'lots'],
  ]) {
    const route = parseScreenRoute(`#${path}`);
    assert.equal(route.page, 'Inventory');
    assert.equal(route.path, path);
    assert.equal(route.inventoryPage, inventoryPage);
  }
});

test('dashboard has a direct workspace route', () => {
  assert.equal(parseScreenRoute('#/dashboard').page, 'Dashboard');
  assert.equal(parseScreenRoute('#/dashboard').path, '/dashboard');
});

test('customer detail routes preserve saved and historical identities', async () => {
  const { customerPath } = await import('../src/app/navigation/screen-route.ts');
  for (const key of ['customer-123', 'order:old/order with spaces', 'অতিথি']) {
    const route = parseScreenRoute(customerPath(key));
    assert.equal(route.page, 'Customers');
    assert.equal(route.customerKey, key);
    assert.equal(route.path, customerPath(key));
  }
  assert.equal(parseScreenRoute('/customers/%').path, '/orders');
});

test('detail and creation tabs are independent of their lists and reopen without duplicates', async () => {
  const { addScreenTab, screenTabKey } = await import('../src/app/navigation/screen-route.ts');
  let tabs = ['Orders'];
  for (const path of ['/orders/new', '/orders/a', '/orders/b', '/orders/a'])
    tabs = addScreenTab(tabs, parseScreenRoute(path));
  assert.deepEqual(tabs, ['Orders', '/orders/new', '/orders/a', '/orders/b']);
  assert.equal(screenTabKey(parseScreenRoute('/inventory/lots')), 'Inventory');
  assert.equal(screenTabKey(parseScreenRoute('/catalog/categories')), 'Catalog');
  assert.deepEqual(addScreenTab([], parseScreenRoute('/customers/c')), ['Customers', '/customers/c']);
});

test('saving a new order replaces only its creation tab and keeps other tabs', async () => {
  const { addScreenTab } = await import('../src/app/navigation/screen-route.ts');
  const tabs = ['Orders', '/orders/new', '/orders/a', 'Inventory'];
  assert.deepEqual(addScreenTab(tabs, parseScreenRoute('/orders/saved'), '/orders/new'), [
    'Orders',
    '/orders/saved',
    '/orders/a',
    'Inventory',
  ]);
  assert.deepEqual(addScreenTab(tabs, parseScreenRoute('/orders/a'), '/orders/new'), [
    'Orders',
    '/orders/a',
    'Inventory',
  ]);
  assert.deepEqual(tabs, ['Orders', '/orders/new', '/orders/a', 'Inventory']);
});
