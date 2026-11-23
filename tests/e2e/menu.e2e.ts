import { readFileSync } from 'node:fs';
import type { Download } from '@playwright/test';
import {
  act,
  closeByScrim,
  copied,
  expect,
  expectGhost,
  fixturePath,
  focusEnd,
  hasFixture,
  open,
  openMenu,
  readFixture,
  run,
  seed,
  stored,
  storedSettings,
  stubClipboard,
  tapRow,
  test,
} from './helpers';
import type { Step } from './helpers';

const LAST_ENTRY =
  '11/22\nPull\nWeighted chin ups-200-2/180-4/\nUnderhand rows-370-6/370-6/370-5/\nHammer curls-75-4/70-5/';

const NEW_BENCH: Step[] = ['tap:newline', 'tap:newline', 'enter', 'enter', 'type:P', 'enter', 'enter', 'enter'];

test.describe('menu and sheet', () => {
  test.beforeEach(async ({ page }) => {
    await stubClipboard(page);
  });

  test('sheet mechanics', async ({ page }) => {
    await open(page);
    await openMenu(page);
    await expect(page.locator('.sheet')).toBeVisible();
    await closeByScrim(page);

    await openMenu(page);
    let box = (await page.locator('.sheet').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + 14;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y + (box.height * 0.6 * i) / 6);
    await page.mouse.up();
    await expect(page.locator('.sheet')).toHaveCount(0);

    await openMenu(page);
    box = (await page.locator('.sheet').boundingBox())!;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(x, y + (box.height * 0.1 * i) / 5);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(page.locator('.sheet')).toHaveCount(1);
    expect(Math.abs((await page.locator('.sheet').boundingBox())!.y - box.y)).toBeLessThan(1);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  test('copy all, copy entry', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await seed(page, F);
    await openMenu(page);
    await tapRow(page, 'copy-all');
    await expect(page.locator('.sheet')).toHaveCount(0);
    expect(await copied(page)).toBe(F);
    expect(await copied(page)).toBe(await stored(page));

    await openMenu(page);
    await tapRow(page, 'copy-entry');
    await expect(page.locator('.sheet')).toHaveCount(0);
    expect(await copied(page)).toBe(LAST_ENTRY);
  });

  test('import round trip', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await open(page);
    await openMenu(page);
    await tapRow(page, 'import');
    await page.locator('[data-field=import]').fill(F);
    await tapRow(page, 'replace');
    await expect(page.locator('.confirm-text')).toHaveText('Replace the whole log?');
    await tapRow(page, 'cancel');
    expect(await stored(page)).toBeUndefined();
    await tapRow(page, 'replace');
    await tapRow(page, 'confirm');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect.poll(() => stored(page)).toBe(F);

    await openMenu(page);
    await tapRow(page, 'copy-all');
    expect(await copied(page)).toBe(F);
    await expect(page.locator('.sheet')).toHaveCount(0);

    await page.locator('.cm-content').focus();
    await page.keyboard.press('Meta+z');
    await expect.poll(() => stored(page)).toBe('');
  });

  test('export fallback downloads both files', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    });
    const downloads: Download[] = [];
    page.on('download', d => downloads.push(d));
    await seed(page, readFixture());
    await openMenu(page);
    await tapRow(page, 'export');
    await expect.poll(() => downloads.length).toBe(2);
    const byName = Object.fromEntries(downloads.map(d => [d.suggestedFilename(), d]));
    expect(Object.keys(byName).sort()).toEqual(['logbook-2026-11-23.txt', 'logbook-settings.json']);
    const txt = readFileSync((await byName['logbook-2026-11-23.txt'].path())!);
    expect(txt.equals(readFileSync(fixturePath))).toBe(true);
    const json = JSON.parse(readFileSync((await byName['logbook-settings.json'].path())!, 'utf8'));
    expect(Array.isArray(json.aliases)).toBe(true);
  });

  test('lint panel', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    await openMenu(page);
    await tapRow(page, 'lint');
    const rows = page.locator('.lint-row');
    await expect(rows).toHaveCount(18);
    await expect(rows.first()).toContainText('100');
    await expect(rows.first()).toContainText('Bad number');
    await page.locator('.lint-row[data-line="1424"]').tap();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('.cm-lint', { hasText: 'Legs-405-2/365-6/365-3/' })).toBeInViewport();
    await page.keyboard.type('X');
    await expect.poll(async () => (await stored(page)) ?? '').toContain('Legs-405-2/365-6/365-3/X\n');
  });

  test('settings target changes the suggestion', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await seed(page, F);
    await openMenu(page);
    await tapRow(page, 'settings');
    await page.locator('input[data-field="target"][data-key="bench"]').fill('3');
    await closeByScrim(page);
    await expect.poll(async () => (await storedSettings(page))?.exercises?.bench?.target).toBe(3);

    await focusEnd(page);
    for (const s of NEW_BENCH) await act(page, s);
    await expectGhost(page, '-295');

    await page.reload();
    await page.locator('.cm-content').waitFor();
    await openMenu(page);
    await tapRow(page, 'settings');
    await expect(page.locator('input[data-field="target"][data-key="bench"]')).toHaveValue('3');
  });

  test('aliases change the suggestion', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    await openMenu(page);
    await tapRow(page, 'settings');
    const area = page.locator('[data-field=aliases]');
    await area.fill((await area.inputValue()) + '\nChin ups, Weighted chin ups');
    await closeByScrim(page);
    await focusEnd(page);
    await run(page, [['tap:newline', null]]);
  });

  for (const state of ['menu open', 'menu closed']) {
    test(`design guards, ${state}`, async ({ page }) => {
      test.skip(!hasFixture, 'fixture not present');
      await seed(page, readFixture());
      if (state === 'menu open') await openMenu(page);
      const bad = await page.evaluate(() => {
        const found: string[] = [];
        for (const e of Array.from(document.querySelectorAll('*'))) {
          const s = getComputedStyle(e);
          const filter = s.getPropertyValue('backdrop-filter') || s.getPropertyValue('-webkit-backdrop-filter');
          const name = `${e.tagName}.${e.className}`;
          if (s.boxShadow !== 'none') found.push(`${name} box-shadow ${s.boxShadow}`);
          if (filter && filter !== 'none') found.push(`${name} backdrop-filter ${filter}`);
          if (s.backgroundImage !== 'none') found.push(`${name} background-image ${s.backgroundImage}`);
        }
        return found;
      });
      expect(bad).toEqual([]);
      const menu = (await page.locator('[data-action=menu]').boundingBox())!;
      expect(menu.width).toBeGreaterThanOrEqual(44);
      expect(menu.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('[data-action=accept]')).toHaveCSS('background-color', 'rgb(242, 242, 242)');
    });
  }
});
