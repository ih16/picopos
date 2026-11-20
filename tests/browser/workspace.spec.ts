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
