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

test('screenshot: import confirm', async ({ page }) => {
  await open(page);
  await openMenu(page);
  await tapRow(page, 'import');
  await page.locator('[data-field=import]').fill('11/23\nPush\nBench-290-4/270-5/');
  await tapRow(page, 'replace');
  await shot(page, 'import.png');
});
