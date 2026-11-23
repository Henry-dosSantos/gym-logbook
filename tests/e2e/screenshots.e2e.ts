import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expectGhost, hasFixture, open, openMenu, readFixture, seed, tapRow, test } from './helpers';

const dir = fileURLToPath(new URL('../../screenshots/', import.meta.url));

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(350);
  await page.screenshot({ path: dir + name, scale: 'css' });
}

test('screenshot: empty', async ({ page }) => {
  await open(page);
  await expectGhost(page, '11/23');
  await shot(page, 'empty.png');
});

test.describe('with the real log', () => {
  test.skip(!hasFixture, 'fixture not present');

  test('screenshot: mid entry', async ({ page }) => {
    await seed(page, readFixture() + '\n\n11/23\nPush\nBench-290-4/');
    await expectGhost(page, '270');
    await shot(page, 'mid-entry.png');
  });

  test('screenshot: sheet, lint, settings', async ({ page }) => {
    await seed(page, readFixture());
    await openMenu(page);
    await shot(page, 'sheet.png');
    await tapRow(page, 'lint');
    await shot(page, 'lint.png');
    await page.keyboard.press('Escape');
    await openMenu(page);
    await tapRow(page, 'settings');
    await shot(page, 'settings.png');
  });
});

test.describe('dashboard screenshots', () => {
  test.skip(!hasFixture, 'fixture not present');

  test('screenshot: dashboard', async ({ page }) => {
    await seed(page, readFixture());
    await openMenu(page);
    await tapRow(page, 'dashboard');
    await page.locator('.dash-row').first().waitFor();
    await shot(page, 'dashboard.png');
    await page.locator('.dash-row[data-key="bench"]').tap();
    await page.waitForTimeout(500);
    await shot(page, 'dashboard-detail.png');
    const box = (await page.locator('.chart').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await page.mouse.down();
    await shot(page, 'dashboard-scrub.png');
    await page.mouse.up();
    await page.locator('[data-action=back]').tap();
    await page.waitForTimeout(500);
    await page.locator('.dash-row[data-key="leg extensions"]').tap();
    await page.waitForTimeout(500);
    await shot(page, 'dashboard-reps.png');
  });
});

test('screenshot: import confirm', async ({ page }) => {
  await open(page);
  await openMenu(page);
  await tapRow(page, 'import');
  await page.locator('[data-field=import]').fill('11/23\nPush\nBench-290-4/270-5/');
  await tapRow(page, 'replace');
  await shot(page, 'import.png');
});
