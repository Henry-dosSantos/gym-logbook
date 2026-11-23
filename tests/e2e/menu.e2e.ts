import {
  act,
  closeByScrim,
  copied,
  expect,
  hasFixture,
  open,
  openMenu,
  readFixture,
  seed,
  setClipboard,
  stored,
  strip,
  stubClipboard,
  tapRow,
  test,
} from './helpers';

const LAST_ENTRY =
  '11/22\nPull\nWeighted chin ups-200-2/180-4/\nUnderhand rows-370-6/370-6/370-5/\nHammer curls-75-4/70-5/';

test.describe('menu and sheet', () => {
  test.beforeEach(async ({ page }) => {
    await stubClipboard(page);
  });

  test('menu rows', async ({ page }) => {
    await open(page);
    await openMenu(page);
    await expect(page.locator('.sheet .row')).toHaveText(
      ['Dashboard', 'Copy all', "Copy today's workout", 'Paste', 'Lint', 'Settings'].map(
        label => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      ),
    );
    await expect(page.locator('[data-action="export"]')).toHaveCount(0);
    await expect(page.locator('[data-action="import"]')).toHaveCount(0);
  });

  test('head has no status bar style meta', async ({ page }) => {
    await open(page);
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(0);
  });

  test('sheet mechanics', async ({ page }) => {
    await open(page);
    await openMenu(page);
    await expect(page.locator('.sheet')).toBeVisible();
    await closeByScrim(page);

    await openMenu(page);
    await page.waitForTimeout(400);
    let box = (await page.locator('.sheet').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + 14;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y + (box.height * 0.6 * i) / 6);
    await page.mouse.up();
    await expect(page.locator('.sheet')).toHaveCount(0);

    await openMenu(page);
    await page.waitForTimeout(400);
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

  test('copy all and copy today', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await seed(page, F);
    await openMenu(page);
    await tapRow(page, 'copy-all');
    await expect(page.locator('.sheet')).toHaveCount(0);
    expect(await copied(page)).toBe(F);
    expect(await copied(page)).toBe(await stored(page));

    await openMenu(page);
    await tapRow(page, 'copy-today');
    await expect(page.locator('.sheet')).toHaveCount(0);
    expect(await copied(page)).toBe(LAST_ENTRY);
  });

  test('copy today picks the entry dated today', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    for (const s of ['enter', 'enter', 'enter', 'enter', 'type:Push'] as const) await act(page, s);
    await expect.poll(() => stored(page)).toContain('\n\n11/23\nPush');
    await openMenu(page);
    await tapRow(page, 'copy-today');
    await expect(page.locator('.sheet')).toHaveCount(0);
    expect(await copied(page)).toBe('11/23\nPush');
  });

  test('paste into an empty app', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await open(page);
    await setClipboard(page, F);
    await openMenu(page);
    await tapRow(page, 'paste');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect.poll(() => stored(page)).toBe(F);
  });

  test('paste at the cursor and undo', async ({ page }) => {
    await seed(page, 'abc');
    await setClipboard(page, 'XYZ');
    await openMenu(page);
    await tapRow(page, 'paste');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect.poll(() => stored(page)).toBe('abcXYZ');
    await page.locator('.cm-content').focus();
    await page.keyboard.press('Meta+z');
    await expect.poll(() => stored(page)).toBe('abc');
  });

  test('paste normalizes line endings', async ({ page }) => {
    await open(page);
    await setClipboard(page, 'A\r\nB');
    await openMenu(page);
    await tapRow(page, 'paste');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect.poll(() => stored(page)).toBe('A\nB');
  });

  test('declined paste changes nothing', async ({ page }) => {
    await seed(page, 'abc');
    await setClipboard(page, null);
    await openMenu(page);
    await tapRow(page, 'paste');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await stored(page)).toBe('abc');
  });

  test('native paste still works', async ({ page }) => {
    await seed(page, 'abc');
    await page.locator('.cm-content').focus();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '123');
      document
        .querySelector('.cm-content')!
        .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect.poll(() => stored(page)).toBe('abc123');
  });

  test('strip overlay', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    const bar = page.locator('.strip-bar');
    await expect(bar).toBeVisible();
    expect(await strip(page)).toHaveLength(2);
    const editor = (await page.locator('.editor').boundingBox())!;
    expect(editor.y + editor.height).toBe(852);
    expect((await page.locator('.strip').boundingBox())!.height).toBe(24);

    await act(page, 'enter');
    await act(page, 'enter');
    await expect(bar).toBeHidden();

    await seed(page, readFixture());
    await expect(bar).toBeVisible();
    await openMenu(page);
    await expect(bar).toBeHidden();
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

  const states = [
    'menu closed',
    'menu open',
    'dashboard list',
    'dashboard detail',
    'settings root',
    'exercise page',
    'merged names page',
  ];
  for (const state of states) {
    test(`design guards, ${state}`, async ({ page }) => {
      test.skip(!hasFixture, 'fixture not present');
      await seed(page, readFixture());
      if (state !== 'menu closed') await openMenu(page);
      if (state.startsWith('dashboard')) await tapRow(page, 'dashboard');
      if (state.startsWith('dashboard')) await page.locator('.dash-row').first().waitFor();
      if (state === 'dashboard detail') {
        await page.locator('.dash-row[data-key="bench"]').tap();
        await expect(page.locator('.readout-value')).toHaveText('290');
      }
      if (state.startsWith('settings') || state === 'exercise page' || state === 'merged names page') {
        await tapRow(page, 'settings');
        await page.locator('[data-action=exercises]').waitFor();
      }
      if (state === 'exercise page') {
        await page.locator('[data-action=exercises]').tap();
        await page.locator('.nav-row[data-key="bench"]').tap();
        await expect(page.locator('[data-footer=exercise]')).toBeVisible();
      }
      if (state === 'merged names page') {
        await page.locator('[data-action=names]').tap();
        await page.locator('[data-group="0"]').waitFor();
      }
      await page.waitForTimeout(500);
      const bad = await page.evaluate(() => {
        const found: string[] = [];
        for (const e of Array.from(document.querySelectorAll('*'))) {
          const s = getComputedStyle(e);
          const filter = s.getPropertyValue('backdrop-filter') || s.getPropertyValue('-webkit-backdrop-filter');
          const name = `${e.tagName}.${String(e.getAttribute('class'))}`;
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
      const colors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('svg *')).flatMap(e =>
          ['fill', 'stroke'].map(a => e.getAttribute(a)).filter((v): v is string => v !== null),
        ),
      );
      const allowed = new Set(['none', '#F2F2F2', '#8A8A8A', '#262626', '#0A0A0A']);
      expect(colors.filter(c => !allowed.has(c))).toEqual([]);
      if (state === 'dashboard detail') expect(colors.length).toBeGreaterThan(0);
    });
  }
});
