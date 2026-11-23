import type { Page } from '@playwright/test';
import { expandSheet, expect, hasFixture, readFixture, seed, tapTab, test } from './helpers';

test.describe('dashboard', () => {
  test.skip(!hasFixture, 'fixture not present');

  test.beforeEach(async ({ page }) => {
    await seed(page, readFixture());
  });

  async function openDashboard(page: Page): Promise<void> {
    await tapTab(page, 'dashboard');
    await page.locator('.dash-row').first().waitFor();
    await expandSheet(page);
  }

  async function openDetail(page: Page, key: string): Promise<void> {
    await page.locator(`.dash-row[data-key="${key}"]`).tap();
    await expect(page.locator('.readout-value')).not.toHaveText('');
    await page.waitForTimeout(500);
  }

  const latest = (page: Page, key: string) => page.locator(`.dash-row[data-key="${key}"] .dash-latest`);

  test('list in both modes', async ({ page }) => {
    await openDashboard(page);
    const first = page.locator('.dash-row').first();
    await expect(first.locator('.dash-name')).toHaveText('Bench');
    await expect(first.locator('.dash-meta')).toHaveText('59 sessions');
    await expect(first.locator('.dash-latest')).toHaveText('290 × 3');
    expect(await first.locator('.spark path').getAttribute('d')).toMatch(/^M.+L/);
    await expect(latest(page, 'leg extensions')).toHaveText('max × 10');
    await expect(page.locator('.dash-list [data-mode="sets"]')).toHaveAttribute('aria-selected', 'true');

    await page.locator('.dash-list [data-mode="1rm"]').tap();
    await expect(page.locator('.dash-list [data-mode="1rm"]')).toHaveAttribute('aria-selected', 'true');
    await expect(first.locator('.dash-latest')).toHaveText('322');
    await expect(latest(page, 'leg extensions')).not.toContainText('×');
  });

  test('detail in sets mode, scrub, then 1RM', async ({ page }) => {
    await openDashboard(page);
    await openDetail(page, 'bench');
    await expect(page.locator('.detail-name')).toHaveText('Bench');
    await expect(page.locator('.readout-date')).toHaveText('11/21');
    await expect(page.locator('.readout-value')).toHaveText('290');
    await expect(page.locator('.readout-suffix')).toHaveText('× 3');
    const d = (await page.locator('.chart-weight .chart-line').getAttribute('d'))!;
    expect(d.split('L').length - 1).toBe(58);
    expect(await page.locator('.chart-reps .chart-line').getAttribute('d')).not.toBe('');
    await expect(page.locator('[data-stat=best]')).toHaveText('315');
    await expect(page.locator('[data-stat=latest]')).toHaveText('290 × 3');
    await expect(page.locator('[data-stat=sessions]')).toHaveText('59');
    const recent = page.locator('.recent-row');
    await expect(recent).toHaveCount(8);
    await expect(recent.first()).toContainText('11/21');
    await expect(recent.first()).toContainText('290-3/270-5/245-9');

    const box = (await page.locator('.chart-weight').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 9, y);
    await page.mouse.down();
    await expect(page.locator('.readout-date')).toHaveText('1/1');
    await expect(page.locator('.readout-value')).toHaveText('225');
    await expect(page.locator('.readout-suffix')).toHaveText('× 3');
    await expect(page.locator('.chart-weight .chart-dot')).toHaveAttribute('visibility', 'visible');
    await expect(page.locator('.chart-reps .chart-scrub')).toHaveAttribute('visibility', 'visible');
    await page.mouse.move(box.x + box.width / 2, y, { steps: 5 });
    await expect(page.locator('.readout-date')).not.toHaveText('1/1');
    await page.mouse.up();
    await expect(page.locator('.readout-date')).toHaveText('11/21');
    await expect(page.locator('.readout-value')).toHaveText('290');

    await page.locator('.dash-detail [data-mode="1rm"]').tap();
    await expect(page.locator('.readout-value')).toHaveText('322');
    await expect(page.locator('.readout-suffix')).toHaveText('est. 1RM');
    await expect(page.locator('.chart-1rm .chart-line')).toHaveCount(1);
    await expect(page.locator('.chart-weight')).toHaveCount(0);
    await expect(recent.first()).toContainText('11/21');
    await expect(recent.first()).toContainText('322');
    await expect(recent.first()).toContainText('245 × 9');
    await expect(page.locator('.dash-footer')).toBeVisible();

    const box1 = (await page.locator('.chart-1rm').boundingBox())!;
    await page.mouse.move(box1.x + 9, box1.y + box1.height / 2);
    await page.mouse.down();
    await expect(page.locator('.readout-date')).toHaveText('1/1');
    await page.mouse.up();
    await expect(page.locator('.readout-date')).toHaveText('11/21');

    await page.locator('.dash-detail [data-action=back]').tap();
    await page.waitForTimeout(500);
    await expect(page.locator('.dash-list')).toBeVisible();
    await expect(page.locator('.dash-detail')).toHaveCount(0);
    await expect(page.locator('.dash-list [data-mode="1rm"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.dash-row').first().locator('.dash-latest')).toHaveText('322');
  });

  test('max sets read as max', async ({ page }) => {
    await openDashboard(page);
    await openDetail(page, 'leg extensions');
    await expect(page.locator('.readout-value')).toHaveText('max');
    await expect(page.locator('.readout-suffix')).toHaveText('× 10');
  });
});
