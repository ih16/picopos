// Capture only a fresh demo session. The output directory holds intermediate frames.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [base, out, ...selected] = process.argv.slice(2);
if (!base || !out)
  throw new Error('Usage: node scripts/capture-help.mjs <local URL> <frames directory> [guide...]');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
const guides = [
  'getting-started',
  'navigation',
  'sales-reporting',
  'create-product',
  'product-variants',
  'categories',
  'customer-directory',
  'create-order',
  'order-lifecycle',
  'payments',
  'returns',
  'stock-movements',
  'purchase-lots',
  'shipping-settings',
];
try {
  for (const id of guides.filter((id) => !selected.length || selected.includes(id))) {
    const dir = join(out, id);
    await mkdir(dir, { recursive: true });
    const mobile = id === 'navigation';
    const page = await browser.newPage({
      viewport: mobile ? { width: 440, height: 660 } : { width: 980, height: 784 },
      reducedMotion: 'reduce',
    });
    page.setDefaultTimeout(6000);
    const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' }).first();
    const frames = [];
    async function shot(caption, target) {
      let point;
      if (target) {
        await target.scrollIntoViewIfNeeded();
        const box = await target.boundingBox();
        point = [box.x + box.width / 2, box.y + box.height / 2];
      }
      await page.waitForTimeout(180);
      await page.screenshot({ path: join(dir, frames.length + '.png'), animations: 'disabled' });
      frames.push({ caption, point });
    }
    async function click(target, caption) {
      await shot(caption, target);
      await target.click();
    }
    async function go(path) {
      await page.evaluate((p) => (location.hash = '/' + p), path);
      await page.waitForTimeout(350);
    }
    try {
      await page.goto(base);
      const demo = button('Try the demo');
      if (id === 'getting-started') await shot('Choose Try the demo.', demo);
      await demo.click();
      await page.getByText('Leave Demo', { exact: true }).last().waitFor({ state: 'attached' });
      switch (id) {
        case 'getting-started':
          await shot('Explore sales in the demo shop.');
          break;
        case 'navigation':
          await click(button('More options'), 'Tap More in the bottom bar.');
          await page.getByRole('link', { name: /Help/ }).last().waitFor();
          await shot('Find Settings and Help here.');
          break;
        case 'sales-reporting':
          await click(button('Date range'), 'Choose Date range.');
          await click(button('Apply range'), 'Apply the dates to the report.');
          await shot('Read sales for the selected period.');
          break;
        case 'create-product':
          await go('catalog');
          await click(button('Add product'), 'Choose Add product.');
          await page.getByLabel('Product name', { exact: true }).fill('Canvas tote');
          await page.getByLabel('SKU', { exact: true }).fill('TOTE-01');
          await page
            .getByLabel(/^Price/)
            .last()
            .fill('18');
          await click(button('Save product'), 'Save the product and its first SKU.');
          await shot('The product is ready for inventory.');
          break;
        case 'product-variants':
          await go('catalog');
          await click(button(/^Variants for /), 'Expand the product’s variants.');
          await click(button(/^Edit variant /), 'Choose a variant to edit.');
          await shot('Review its SKU, price and status.');
          break;
        case 'categories':
          await go('catalog/categories');
          await click(button(/^Add subcategory to /), 'Choose Add subcategory on the parent.');
          await shot('Name the category and check its parent.');
          break;
        case 'customer-directory':
          await go('customers');
          await click(
            page.locator('.customers-table tbody button:visible').first(),
            'Open a customer from the directory.',
          );
          await shot('Review contact details and order history.');
          break;
        case 'create-order':
          await go('orders');
          await click(button('New order'), 'Choose New order.');
          await shot('Start with the customer, then add items.');
          break;
        case 'order-lifecycle':
        case 'payments':
        case 'returns': {
          await go('orders');
          const status = id === 'returns' ? 'Shipped' : 'In progress';
          await page
            .locator('.orders-table tbody tr')
            .filter({ has: page.locator('[data-status="' + status + '"]') })
            .first()
            .getByRole('button')
            .click();
          if (id === 'order-lifecycle') {
            await click(button('Mark shipped'), 'Mark the packed order as shipped.');
            await button('Mark completed').waitFor();
            await shot('Mark completed after delivery.');
          } else if (id === 'returns') {
            await click(button('Add return'), 'Choose Add return.');
            await button('Save return').scrollIntoViewIfNeeded();
            await shot('Select the item and quantity to return.');
          } else {
            const radio = page.locator('input[type=radio]:not(:checked):visible').first();
            await click(radio, 'Choose the new payment status.');
            await shot('Fulfilment status stays independent.');
          }
          break;
        }
        case 'stock-movements':
          await go('inventory');
          await click(button(/^Add stock entry for /), 'Choose the stock action for a SKU.');
          await shot('Enter the movement and review the balance.');
          break;
        case 'purchase-lots':
          await go('inventory/lots');
          await click(page.locator('[title="Show stock entries"]:visible').first(), 'Expand a purchase lot.');
          await shot('Review the entries linked to this lot.');
          break;
        case 'shipping-settings':
          await go('settings');
          await click(button('Add shipping option'), 'Choose Add shipping option.');
          await page.locator('.settings-shipping-row').last().locator('input').first().fill('Express');
          await page.locator('.settings-shipping-row').last().locator('input').last().fill('8');
          await click(button('Save settings'), 'Save the delivery name and rate.');
          await shot('The shipping option is ready for orders.');
          break;
      }
      await writeFile(join(dir, 'frames.json'), JSON.stringify(frames));
      console.log(id, frames.length);
    } catch (error) {
      process.exitCode = 1;
      console.error(id, error.message);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
