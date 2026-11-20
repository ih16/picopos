import { expect, test } from '@playwright/test';

test('workspace keeps an order draft across tabs and opens its saved detail', async ({ page }) => {
  await page.goto('/#/orders/new');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  const screen = page.locator('.workspace-page:visible');
  for (const [label, search] of [
    ['Saved customer', 'Maya'],
    ['Product / variant 1', 'tote'],
    ['Shipping option', ''],
  ]) {
    const field = screen.getByRole('combobox', { name: label, exact: true });
    await field.click();
    if (search) await field.fill(search);
    await field.press('ArrowDown');
    await field.press('Enter');
  }
  const quantity = screen.getByLabel('Quantity', { exact: true });
  await quantity.fill('2');
  await page
    .getByRole('navigation', { name: 'Workspace', exact: true })
    .getByRole('button', { name: 'Settings' })
    .click();
  await expect(screen.getByText('Shipping rates', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Open pages' })
    .getByRole('button', { name: 'New order', exact: true })
    .click();
  await expect(quantity).toHaveValue('2');
  await screen.getByRole('button', { name: 'Create draft' }).click();
  await expect(screen.getByRole('heading', { name: /^P-/ })).toBeVisible();
  await expect(page).toHaveURL(/#\/orders\/(?!new).+/);
});

test('restores the demo ahead of a saved workbook and opens Help offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  await expect(page.getByText('Demo changes reset on reload or exit.')).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      'piecom.workbook',
      JSON.stringify({ id: 'offline-fixture', name: 'Example workbook' }),
    ),
  );
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Demo changes reset on reload or exit.')).toBeVisible();
  await page.goto('/help/');
  await expect(page.getByRole('heading', { name: 'Shop help' })).toBeVisible();
  await page.getByRole('searchbox').fill('shipping');
  await expect(page.locator('.help-result-count')).not.toHaveText(/^0 guides/);
});

test('keeps an expanded product while filtering and opens its variant editor', async ({ page }) => {
  await page.goto('/#/catalog');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  const card = page.locator('.product-card').first();
  const product = await card.getByRole('heading').innerText();
  const toggle = card.getByRole('button', { name: 'Variants for ' + product, exact: true });
  await toggle.click();
  await page.getByRole('searchbox', { name: 'Search products' }).fill(product);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await card
    .getByRole('button', { name: /^Edit variant / })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(
    'Orders can jump to distant local pages and search the whole workbook at width ' + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 870 });
      await page.goto('/#/orders');
      await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
      const list = page.locator('.orders-list .paged-viewport');
      const buttons = list.getByRole('button');
      const number = async () =>
        width === 1440 ? buttons.first().innerText() : list.locator('.mobile-record p').first().innerText();
      if (width === 1440) {
        const header = await page.locator('.orders-table thead').boundingBox();
        const body = await list.boundingBox();
        expect(body!.y).toBeCloseTo(header!.y + header!.height, 0);
        expect(body!.width).toBeCloseTo(header!.width, 0);
      }
      const initialNumber = await number();
      expect(await buttons.count()).toBeLessThan(64);
      const dataRequests: string[] = [];
      page.on('request', (request) => {
        if (['fetch', 'xhr'].includes(request.resourceType())) dataRequests.push(request.url());
      });
      await list.evaluate((el) => {
        el.scrollTop = el.scrollHeight / 2;
      });
      await expect.poll(number).not.toBe(initialNumber);
      const middleNumber = await number();
      await list.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect.poll(number).not.toBe(middleNumber);
      const last = (
        width === 1440
          ? await buttons.last().innerText()
          : await list.locator('.mobile-record p').last().innerText()
      ).split(' · ')[0];
      expect(await buttons.count()).toBeLessThan(64);
      await list.evaluate((el) => {
        el.scrollTop = 0;
      });
      await expect.poll(number).toBe(initialNumber);
      if (width === 1440) {
        const header = page
          .locator('.orders-table')
          .getByRole('columnheader', { name: 'Order', exact: true });
        await header.getByRole('button').click();
        await expect(header).toHaveAttribute('aria-sort', 'ascending');
        const lowest = await number();
        await header.getByRole('button').press('Enter');
        await expect(header).toHaveAttribute('aria-sort', 'descending');
        expect(lowest.localeCompare(await number(), undefined, { numeric: true })).toBeLessThan(0);
      }
      if (width === 390) await page.getByRole('button', { name: 'Filter orders' }).click();
      await page.getByRole('searchbox', { name: 'Search orders' }).fill(last);
      if (width === 390) await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(buttons).toHaveCount(1);
      await buttons.first().click();
      await expect(page.getByRole('heading', { name: last, exact: true })).toBeVisible();
      expect(dataRequests).toEqual([]);
    },
  );
}

test('a keyboard selection can reach the last customer outside the mounted options', async ({ page }) => {
  await page.goto('/#/orders/new');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  const field = page.getByRole('combobox', { name: 'Saved customer', exact: true });
  await field.click();
  const options = page.getByRole('listbox', { name: 'Saved customer' }).getByRole('option');
  const size = Number(await options.first().getAttribute('aria-setsize'));
  expect(size).toBeGreaterThan(await options.count());
  await field.press('ArrowUp');
  await expect(options.last()).toHaveAttribute('aria-posinset', String(size));
  const name = await options.last().innerText();
  await field.press('Enter');
  await expect(field).toHaveValue(name.trim());
});

test('mobile catalog scrolls records and editor fields inside a stationary workspace', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('/#/catalog');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  const list = page.locator('.product-grid');
  const filter = page.getByRole('button', { name: 'Filter products', exact: true });
  const add = page.getByRole('button', { name: 'Add product', exact: true });
  const bounds = await Promise.all([filter.boundingBox(), add.boundingBox()]);
  await list.evaluate((el) => {
    el.scrollTop = el.clientHeight;
  });
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await Promise.all([filter.boundingBox(), add.boundingBox()])).toEqual(bounds);
  await filter.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await add.click();
  const fields = dialog.locator('.editor-fields');
  const footer = dialog.locator('.action-bar');
  const header = dialog.locator('.ui-modal-header');
  await expect(footer).toBeInViewport();
  await fields.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => fields.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(header).toBeInViewport();
  await expect(footer).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.scrollingElement!.scrollHeight - document.documentElement.clientHeight,
    ),
  ).toBe(0);
});

test('new orders apply configured charges and keep their breakdown after rates are removed', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  const screen = page.locator('.workspace-page:visible');
  for (const [name, percent] of [
    ['VAT', '15'],
    ['Service charge', '5'],
  ]) {
    await screen.getByRole('button', { name: 'Add charge' }).click();
    await screen.getByLabel('Charge name', { exact: true }).last().fill(name);
    await screen.getByLabel('Percentage (%)', { exact: true }).last().fill(percent);
    if (name === 'VAT') {
      await screen.getByRole('combobox', { name: 'Price treatment' }).last().click();
      await page.getByRole('option', { name: /Inclusive/ }).click();
    }
  }
  await screen.getByRole('button', { name: 'Save settings' }).click();
  await page.evaluate(() => {
    location.hash = '/orders/new';
  });
  for (const [label, search] of [
    ['Saved customer', 'Maya'],
    ['Product / variant 1', 'tote'],
    ['Shipping option', ''],
  ]) {
    const field = screen.getByRole('combobox', { name: label, exact: true });
    await field.click();
    if (search) await field.fill(search);
    await field.press('ArrowDown');
    await field.press('Enter');
  }
  const labels = ['VAT (15% · included)', 'Service charge (5% · added)'];
  for (const label of labels) await expect(screen.getByText(label, { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: 'Create draft' }).click();
  await expect(screen.getByRole('heading', { name: /^P-/ })).toBeVisible();
  const orderHash = new URL(page.url()).hash;
  await page.evaluate(() => {
    location.hash = '/settings';
  });
  for (let i = 0; i < 2; i++) await screen.getByRole('button', { name: 'Remove charge 1' }).click();
  await screen.getByRole('button', { name: 'Save settings' }).click();
  await page.evaluate((hash) => {
    location.hash = hash;
  }, orderHash);
  for (const label of labels)
    await expect(screen.getByText(label, { exact: true }).filter({ visible: true })).toBeVisible();
});

for (const width of [1280, 390]) {
  test(
    'order details position the payment summary and keep actions floating at width ' + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/#/orders');
      await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
      await page
        .locator('.orders-list .paged-viewport:visible')
        .locator('tr, article')
        .filter({ has: page.getByText('Shipped', { exact: true }) })
        .first()
        .getByRole('button')
        .click();
      const detail = page.locator('.order-detail-page:visible');
      const items = detail.locator('.detail-items');
      const summary = detail.locator('.detail-payment');
      await expect(summary.getByText('Order total', { exact: true })).toBeVisible();
      const a = (await items.boundingBox())!;
      const b = (await summary.boundingBox())!;
      if (width === 390) expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
      else expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 1);
      const actions = detail.getByRole('group', { name: 'Order actions' });
      await expect(actions).toHaveCSS('position', 'fixed');
      const before = await actions.boundingBox();
      await detail.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(await actions.boundingBox()).toEqual(before);
      expect(await detail.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    },
  );
}

test('staff can record and update partial payments and refunds', async ({ page }) => {
  await page.goto('/#/orders');
  await page.getByRole('button', { name: 'Try the demo', exact: true }).click();
  await page.locator('.orders-list .paged-viewport:visible button').first().click();
  const detail = page.locator('.order-detail-page:visible');
  for (const [status, field, result] of [
    ['Partially paid', 'Amount paid', 'Balance due'],
    ['Partially refunded', 'Amount refunded', 'Payment retained'],
  ]) {
    await detail.getByRole('radio', { name: status, exact: true }).check();
    await detail.getByRole('spinbutton', { name: new RegExp(field) }).fill('1.25');
    await detail.getByRole('button', { name: 'Save payment' }).click();
    await expect(detail.getByText(new RegExp(result))).toBeVisible();
    await expect(detail.getByRole('spinbutton', { name: new RegExp(field) })).toHaveValue('1.25');
  }
  await detail.getByRole('radio', { name: 'Refunded', exact: true }).check();
  await expect(detail.getByRole('spinbutton', { name: /Amount refunded/ })).toHaveCount(0);
});
