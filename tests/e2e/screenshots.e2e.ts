import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expectGhost, hasFixture, open, openMenu, readFixture, seed, tapRow, test } from './helpers';

const dir = fileURLToPath(new URL('../../screenshots/', import.meta.url));
const TOP = '.sheet .stack-page:last-child';

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(450);
  await page.screenshot({ path: dir + name, scale: 'css' });
}

test('screenshot: empty', async ({ page }) => {
  rmSync(dir + 'import.png', { force: true });
  await open(page);
  await expectGhost(page, '11/23');
  await shot(page, 'empty.png');
});

test.describe('with the real log', () => {
  test.skip(!hasFixture, 'fixture not present');

  test('screenshot: mid entry and reading', async ({ page }) => {
    await seed(page, readFixture() + '\n\n11/23\nPush\nBench-290-4/');
    await expectGhost(page, '270');
    await shot(page, 'mid-entry.png');
    await openMenu(page);
    await page.keyboard.press('Escape');
    await page.locator('.sheet').waitFor({ state: 'detached' });
    await shot(page, 'reading.png');
  });

  test('screenshot: sheet, lint, settings', async ({ page }) => {
    await seed(page, readFixture());
    await openMenu(page);
    await shot(page, 'sheet.png');
    await tapRow(page, 'lint');
    await shot(page, 'lint.png');
    await page.keyboard.press('Escape');
    await page.locator('.sheet').waitFor({ state: 'detached' });

    await openMenu(page);
    await tapRow(page, 'settings');
    await page.locator('[data-action=exercises]').waitFor();
    await shot(page, 'settings.png');

    await page.locator('[data-action=exercises]').tap();
    await page.locator('.nav-row[data-key="incline db"]').waitFor();
    await shot(page, 'settings-exercises.png');

    await page.locator('.nav-row[data-key="incline db"]').tap();
    await page.locator(`${TOP} [data-setting="increment"] [data-step="up"]`).tap();
    await page.locator(`${TOP} [data-setting="increment"] [data-step="up"]`).tap();
    await shot(page, 'settings-exercise.png');

    await page.locator(`${TOP} [data-action=back]`).tap();
    await page.waitForTimeout(450);
    await page.locator(`${TOP} [data-action=back]`).tap();
    await page.waitForTimeout(450);
    await page.locator('[data-action=names]').tap();
    await page.locator(`${TOP} [data-group="0"]`).waitFor();
    await shot(page, 'settings-names.png');

    await page.locator(`${TOP} [data-action=new-group]`).tap();
    await page.locator(`${TOP} [data-action=add-name]`).tap();
    await page.locator(`${TOP} .row[data-name="Chin ups"]`).tap();
    await page.locator(`${TOP} .name-list [data-name]`).waitFor();
    await page.locator(`${TOP} [data-action=add-name]`).tap();
    await page.locator(`${TOP} .row[data-name="Weighted chin ups"]`).tap();
    await page.locator(`${TOP} .name-list [data-name="Weighted chin ups"]`).waitFor();
    await shot(page, 'settings-group.png');
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
