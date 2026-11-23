import type { Page } from '@playwright/test';
import { expandSheet, expect, hasFixture, readFixture, seed, tapTab, test } from './helpers';

// Point sizes: iPhone 16 Pro, and iPhone Duo outer, inner, and inner in landscape (Duo sizes are
// derived from published pixel sizes; the layout reads the real size at runtime either way).
const SCREENS = [
  { name: 'iPhone 16 Pro', width: 402, height: 874, top: 62 },
  { name: 'iPhone Duo outer', width: 466, height: 678, top: 59 },
  { name: 'iPhone Duo inner', width: 669, height: 951, top: 59 },
  { name: 'iPhone Duo inner landscape', width: 951, height: 669, top: 0 },
];

async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    };
    return {
      scrollWidth: document.documentElement.scrollWidth,
      editor: box('.editor'),
      tabbar: box('.tabbar'),
      sheet: box('.sheet'),
      chart: box('.chart-weight'),
      area: box('.chart-area'),
    };
  });
}

test.describe('fills each screen', () => {
  test.skip(!hasFixture, 'fixture not present');

  for (const s of SCREENS) {
    test(s.name, async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height });
      await seed(page, readFixture());
      await page.addStyleTag({ content: `:root { --top: ${s.top}px !important; }` });

      let l = await layout(page);
      expect(l.scrollWidth).toBe(s.width);
      expect(l.editor).toEqual({ x: 0, y: 0, w: s.width, h: s.height });
      expect(s.height - (l.tabbar!.y + l.tabbar!.h)).toBeLessThanOrEqual(8);
      expect(l.tabbar!.w).toBeLessThanOrEqual(560);
      expect(Math.abs(l.tabbar!.x + l.tabbar!.w / 2 - s.width / 2)).toBeLessThanOrEqual(1);
      await expect(page.locator('.cm-content')).toHaveCSS('padding-top', `${s.top + 8}px`);

      await tapTab(page, 'dashboard');
      await page.locator('.dash-row').first().waitFor();
      await page.waitForTimeout(400);
      l = await layout(page);
      expect(l.sheet!.w).toBe(Math.min(640, s.width));
      expect(Math.abs(l.sheet!.x + l.sheet!.w / 2 - s.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(l.sheet!.y - s.height / 2)).toBeLessThanOrEqual(12);

      await expandSheet(page);
      expect((await layout(page)).sheet!.y).toBeLessThanOrEqual(s.top + 16);
      await page.locator('.dash-row[data-key="bench"]').tap();
      await page.waitForTimeout(500);
      l = await layout(page);
      expect(l.chart!.w).toBe(l.area!.w);
      expect(l.chart!.x + l.chart!.w).toBeLessThanOrEqual(l.sheet!.x + l.sheet!.w);
      expect(l.scrollWidth).toBe(s.width);
    });
  }

  test('folding and unfolding the Duo with a sheet open', async ({ page }) => {
    await page.setViewportSize({ width: 466, height: 678 });
    await seed(page, readFixture());
    await tapTab(page, 'dashboard');
    await page.locator('.dash-row').first().waitFor();
    await expandSheet(page);
    await page.locator('.dash-row[data-key="bench"]').tap();
    await page.waitForTimeout(500);

    for (const [width, height] of [
      [669, 951],
      [466, 678],
      [951, 669],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(async () => {
          const l = await layout(page);
          return l.chart!.w === l.area!.w && l.editor!.w === width && l.editor!.h === height && l.scrollWidth === width;
        })
        .toBe(true);
      const l = await layout(page);
      expect(l.sheet!.w).toBe(Math.min(640, width));
      expect(l.sheet!.y + l.sheet!.h).toBeCloseTo(height, 0);
    }
  });
});
