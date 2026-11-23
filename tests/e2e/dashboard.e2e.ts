import type { Page } from '@playwright/test';
import { expect, hasFixture, openMenu, readFixture, seed, tapRow, test } from './helpers';

test.describe('dashboard', () => {
  test.skip(!hasFixture, 'fixture not present');

  test.beforeEach(async ({ page }) => {
    await seed(page, readFixture());
  });

  async function openDashboard(page: Page): Promise<void> {
    await openMenu(page);
    await tapRow(page, 'dashboard');
    await page.locator('.dash-row').first().waitFor();
    await page.waitForTimeout(450);
  }

  async function openDetail(page: Page, key: string): Promise<void> {
    await page.locator(`.dash-row[data-key="${key}"]`).tap();
    await expect(page.locator('.readout-value')).not.toHaveText('');
    await page.waitForTimeout(500);
  }

  test('list', async ({ page }) => {
    await openDashboard(page);
    const top = (await page.locator('.sheet').boundingBox())!.y;
    expect(top).toBeLessThan(60);
    const first = page.locator('.dash-row').first();
    await expect(first.locator('.dash-name')).toHaveText('Bench');
    await expect(first.locator('.dash-meta')).toHaveText('59 sessions');
    await expect(first.locator('.dash-latest')).toHaveText('290');
    expect(await first.locator('.spark path').getAttribute('d')).toMatch(/^M.+L/);
    expect(await page.locator('.dash-row[data-key="leg extensions"] .dash-latest').textContent()).toMatch(/^×/);
  });

  test('detail, scrub, metric, back', async ({ page }) => {
    await openDashboard(page);
    await openDetail(page, 'bench');
    await expect(page.locator('.detail-name')).toHaveText('Bench');
    await expect(page.locator('.readout-date')).toHaveText('11/21');
    await expect(page.locator('.readout-value')).toHaveText('290');
    await expect(page.locator('.readout-suffix')).toHaveText('× 3');
    const d = (await page.locator('.chart-line').getAttribute('d'))!;
    expect(d.split('L').length - 1).toBe(58);
    await expect(page.locator('[data-stat=best]')).toHaveText('315');
    await expect(page.locator('[data-stat=latest]')).toHaveText('290');
    await expect(page.locator('[data-stat=sessions]')).toHaveText('59');
    const recent = page.locator('.recent-row');
    await expect(recent).toHaveCount(8);
    await expect(recent.first()).toContainText('11/21');
    await expect(recent.first()).toContainText('290-3/270-5/245-9');

    const box = (await page.locator('.chart').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 9, y);
    await page.mouse.down();
    await expect(page.locator('.readout-date')).toHaveText('1/1');
    await expect(page.locator('.readout-value')).toHaveText('225');
    await expect(page.locator('.readout-suffix')).toHaveText('× 3');
    await page.mouse.move(box.x + box.width / 2, y, { steps: 5 });
    await expect(page.locator('.readout-date')).not.toHaveText('1/1');
    await page.mouse.up();
    await expect(page.locator('.readout-date')).toHaveText('11/21');
    await expect(page.locator('.readout-value')).toHaveText('290');

    await page.locator('[data-metric=reps]').tap();
    await expect(page.locator('.readout-value')).toHaveText('3');
    await expect(page.locator('.readout-suffix')).toHaveText('reps at 290');
    await expect(page.locator('[data-metric=reps]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-metric=weight]').tap();
    await expect(page.locator('.readout-value')).toHaveText('290');

    await page.locator('[data-action=back]').tap();
    await page.waitForTimeout(500);
    await expect(page.locator('.dash-list')).toBeVisible();
    await expect(page.locator('.dash-detail')).toBeHidden();

    const sheet = (await page.locator('.sheet').boundingBox())!;
    const x = sheet.x + sheet.width / 2;
    await page.mouse.move(x, sheet.y + 14);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, sheet.y + 14 + (sheet.height * 0.6 * i) / 6);
    await page.mouse.up();
    await expect(page.locator('.sheet')).toHaveCount(0);
  });
});
