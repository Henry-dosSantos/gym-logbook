import type { Page } from '@playwright/test';
import {
  act,
  closeByScrim,
  copied,
  dragSheet,
  expect,
  expectGhost,
  focusEnd,
  hasFixture,
  open,
  readFixture,
  seed,
  setClipboard,
  stored,
  strip,
  stubClipboard,
  tapTab,
  test,
} from './helpers';

const LAST_ENTRY =
  '11/22\nPull\nWeighted chin ups-200-2/180-4/\nUnderhand rows-370-6/370-6/370-5/\nHammer curls-75-4/70-5/';

const ACTIONS = ['dashboard', 'copy-today', 'copy-all', 'paste', 'lint', 'settings'];

const FIXES: Record<number, string> = {
  100: 'Back extensions-270-6/270-5/250-6/',
  192: '2/8',
  194: 'Bench-250-8/250-6/225-8/',
  253: '2/22',
  424: '4/1',
  431: '4/2',
  438: '4/6',
  445: '4/7',
  452: '4/9',
  459: '4/11',
  466: '4/13',
  474: '4/15',
  823: 'Calf raises-465-14/465-14/465-12/',
  900: 'Calf raises-3x10-13/',
  1096: '9/1',
  1104: '9/3',
  1372: 'Neutral pull ups-205-2/180-2/',
  1424: 'Rdls-405-2/365-6/365-3/',
};

function withFixes(F: string, skip: number[] = []): string {
  const lines = F.split('\n');
  for (const [n, text] of Object.entries(FIXES)) if (!skip.includes(Number(n))) lines[Number(n) - 1] = text;
  return lines.join('\n');
}

const TOP = '.sheet .stack-page:last-child';

async function noErrorsOnSheets(page: Page, action: string): Promise<void> {
  await tapTab(page, action);
  await expect(page.locator('.sheet.glass')).toBeVisible();
  const box = (await page.locator('.sheet').boundingBox())!;
  expect(box.height).toBeGreaterThan(800);
}

test.describe('bar', () => {
  test.beforeEach(async ({ page }) => {
    await stubClipboard(page);
  });

  test('six tabs', async ({ page }) => {
    await open(page);
    const tabs = page.locator('.tabbar .tab');
    await expect(tabs).toHaveCount(6);
    expect(await tabs.evaluateAll(t => t.map(x => (x as HTMLElement).dataset.action))).toEqual(ACTIONS);
    for (const tab of await tabs.all()) {
      expect(await tab.locator('svg').count()).toBeGreaterThan(0);
      await expect(tab.locator('.tab-label')).toBeVisible();
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('.tabbar')).toHaveClass(/glass/);
    const filter = await page.locator('.tabbar').evaluate(e => {
      const s = getComputedStyle(e);
      return s.getPropertyValue('backdrop-filter') || s.getPropertyValue('-webkit-backdrop-filter');
    });
    expect(filter).not.toBe('none');
    expect(filter).not.toBe('');
    await expect(page.locator('[data-action="menu"]')).toHaveCount(0);
  });

  test('the app is called Dossier', async ({ page }) => {
    await open(page);
    await expect(page).toHaveTitle('Dossier');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Dossier');
    const manifest = await (await page.request.get('manifest.webmanifest')).json();
    expect([manifest.name, manifest.short_name]).toEqual(['Dossier', 'Dossier']);
    for (const icon of ['icons/apple-touch-icon.png', ...manifest.icons.map((i: { src: string }) => i.src)]) {
      expect((await page.request.get(icon)).status()).toBe(200);
    }
  });

  test('text scrolls behind the top inset', async ({ page }) => {
    await open(page);
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
      'content',
      'black-translucent',
    );
    await expect(page.locator('.editor')).toHaveCSS('padding-top', '0px');
    await page.addStyleTag({ content: ':root { --top: 59px !important; }' });
    await expect(page.locator('.cm-content')).toHaveCSS('padding-top', '67px');
    expect((await page.locator('.cm-scroller').boundingBox())!.y).toBe(0);
  });

  test.describe('sheet detents', () => {
    test.skip(!hasFixture, 'fixture not present');

    const top = async (page: Page) => (await page.locator('.sheet').boundingBox())!.y;

    test.beforeEach(async ({ page }) => {
      await seed(page, readFixture());
      await tapTab(page, 'settings');
      await page.locator('[data-action=exercises]').waitFor();
      await page.waitForTimeout(400);
    });

    test('opens at half height, pulls up, settles, dismisses', async ({ page }) => {
      await expect(page.locator('.sheet[data-detent="medium"]')).toHaveCount(1);
      expect(Math.abs((await top(page)) - 426)).toBeLessThanOrEqual(12);

      await dragSheet(page, -300);
      await expect(page.locator('.sheet[data-detent="large"]')).toHaveCount(1);
      await page.waitForTimeout(400);
      expect(await top(page)).toBeLessThanOrEqual(16);

      await dragSheet(page, 300, 40);
      await expect(page.locator('.sheet[data-detent="medium"]')).toHaveCount(1);
      await page.waitForTimeout(400);
      expect(Math.abs((await top(page)) - 426)).toBeLessThanOrEqual(12);

      await dragSheet(page, 300);
      await expect(page.locator('.sheet')).toHaveCount(0);
    });

    test('at half height the whole sheet drags and a drag is not a tap', async ({ page }) => {
      const row = (await page.locator('[data-action=exercises]').boundingBox())!;
      const x = row.x + row.width / 2;
      const y = row.y + row.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(x, y - 25 * i);
      await page.mouse.up();
      await expect(page.locator('.sheet[data-detent="large"]')).toHaveCount(1);
      await page.waitForTimeout(400);
      await expect(page.locator('.stack-page')).toHaveCount(1);
    });

    test('a plain tap at half height opens the row', async ({ page }) => {
      await page.locator('[data-action=exercises]').tap();
      await expect(page.locator(`${TOP} .page-title`)).toHaveText('Custom rules');
    });
  });

  test.describe('lint panel', () => {
    test.skip(!hasFixture, 'fixture not present');

    test.beforeEach(async ({ page }) => {
      await seed(page, readFixture());
      await tapTab(page, 'lint');
      await page.locator('.lint-card').waitFor();
      await page.waitForTimeout(400);
    });

    test('sits at half height over the log, which jumps to each flag', async ({ page }) => {
      await expect(page.locator('.sheet.is-panel[data-detent="medium"]')).toHaveCount(1);
      await expect(page.locator('.scrim')).toHaveCount(0);
      expect(Math.abs((await page.locator('.sheet').boundingBox())!.y - 426)).toBeLessThanOrEqual(12);
      await expect(page.locator('.lint-count')).toHaveText('1 of 18');
      await expect(page.locator('.lint-card .lint-num')).toHaveText('Line 100');
      await expect(page.locator('.lint-card .lint-msg')).toHaveText('Bad number');
      await expect(page.locator('.lint-card .lint-text')).toHaveCSS('font-size', '17px');
      await expect(page.locator('.lint-card .lint-fix-text')).toHaveText(FIXES[100]);
      await expect(page.locator('.lint-card .lint-fix-text')).toHaveCSS('font-size', '17px');
      // The flag fills the visible half; the list starts below the bottom of the screen.
      const label = (await page.locator('.lint .section-label').boundingBox())!;
      expect(label.y).toBeGreaterThanOrEqual(852 - 1);
      const apply = (await page.locator('[data-action=apply]').boundingBox())!;
      expect(apply.y + apply.height).toBeLessThanOrEqual(852);
      expect(apply.height).toBe(50);

      const focused = page.locator('.cm-l-focus');
      await expect(focused).toHaveCount(1);
      await expect(focused).toHaveText('Back extensions-270-6/270-5/250q-6/');
      await expect(focused).toHaveAttribute('data-fix', `→ ${FIXES[100]}`);
      expect(await focused.evaluate(e => getComputedStyle(e, '::after').content)).toBe(`"  " "→ ${FIXES[100]}"`);
      await expect(focused).toHaveCSS('background-color', 'rgb(38, 38, 38)');
      const inTopHalf = async () => {
        const box = (await focused.boundingBox())!;
        return box.y > 0 && box.y + box.height < 426;
      };
      await expect.poll(inTopHalf).toBe(true);

      await page.locator('[data-action=next]').tap();
      await expect(page.locator('.lint-count')).toHaveText('2 of 18');
      await expect(focused).toHaveText('2/8/25');
      await expect.poll(inTopHalf).toBe(true);
      await page.locator('[data-action=prev]').tap();
      await expect(page.locator('.lint-count')).toHaveText('1 of 18');

      await page.locator('.lint-row[data-line="1424"]').tap();
      await expect(page.locator('.lint-count')).toHaveText('18 of 18');
      await expect(focused).toHaveText('Legs-405-2/365-6/365-3/');
      await expect.poll(inTopHalf).toBe(true);
      await expect(page.locator('.lint-row[data-line="1424"]')).toHaveAttribute('aria-current', 'true');
      await expect.poll(async () => (await page.locator('[data-action=apply]').boundingBox())!.y).toBeGreaterThan(426);
      await expect
        .poll(async () => {
          const b = (await page.locator('[data-action=apply]').boundingBox())!;
          return b.y + b.height;
        })
        .toBeLessThanOrEqual(852);

      await page.locator('[data-action=close]').tap();
      await expect(page.locator('.sheet')).toHaveCount(0);
      await expect(focused).toHaveCount(0);
    });

    test('closes with Escape and by dragging down', async ({ page }) => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.sheet')).toHaveCount(0);
      await tapTab(page, 'lint');
      await page.waitForTimeout(400);
      await dragSheet(page, -200);
      await page.waitForTimeout(400);
      await expect(page.locator('.sheet[data-detent="medium"]')).toHaveCount(1);
      expect(Math.abs((await page.locator('.sheet').boundingBox())!.y - 426)).toBeLessThanOrEqual(12);
      await dragSheet(page, 300);
      await expect(page.locator('.sheet')).toHaveCount(0);
    });
  });

  for (const action of ['dashboard', 'settings']) {
    test(`${action} sheet opens and closes`, async ({ page }) => {
      test.skip(!hasFixture, 'fixture not present');
      await seed(page, readFixture());
      await noErrorsOnSheets(page, action);
      await closeByScrim(page);

      await noErrorsOnSheets(page, action);
      await page.keyboard.press('Escape');
      await expect(page.locator('.sheet')).toHaveCount(0);

      await noErrorsOnSheets(page, action);
      await page.waitForTimeout(400);
      const box = (await page.locator('.sheet').boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + 14;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 6; i++) await page.mouse.move(x, y + (box.height * 0.6 * i) / 6);
      await page.mouse.up();
      await expect(page.locator('.sheet')).toHaveCount(0);
    });
  }

  test('lint badge', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    await expect(page.locator('.tab-badge')).toHaveText('18');
  });

  test('copy day and copy all', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await seed(page, F);
    await tapTab(page, 'copy-today');
    expect(await copied(page)).toBe(LAST_ENTRY);
    await expect(page.locator('.tab[data-action=copy-today]')).toHaveClass(/is-done/);
    await expect(page.locator('.tab[data-action=copy-today]')).not.toHaveClass(/is-done/, { timeout: 2500 });

    await tapTab(page, 'copy-all');
    expect(await copied(page)).toBe(F);
    expect(await copied(page)).toBe(await stored(page));
  });

  test('paste into an empty app', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await open(page);
    await setClipboard(page, F);
    await tapTab(page, 'paste');
    await expect.poll(() => stored(page)).toBe(F);
  });

  test('paste at the cursor and undo', async ({ page }) => {
    await seed(page, 'abc');
    await setClipboard(page, 'XYZ');
    await tapTab(page, 'paste');
    await expect.poll(() => stored(page)).toBe('abcXYZ');
    await page.locator('.cm-content').focus();
    await page.keyboard.press('Meta+z');
    await expect.poll(() => stored(page)).toBe('abc');
  });

  test('paste normalizes line endings', async ({ page }) => {
    await open(page);
    await setClipboard(page, 'A\r\nB');
    await tapTab(page, 'paste');
    await expect.poll(() => stored(page)).toBe('A\nB');
  });

  test('declined paste changes nothing', async ({ page }) => {
    await seed(page, 'abc');
    await setClipboard(page, null);
    await tapTab(page, 'paste');
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

  test('strip sits above the bar', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    await expect(page.locator('.strip-bar')).toBeVisible();
    expect(await strip(page)).toHaveLength(2);
    const stripBox = (await page.locator('.strip-bar').boundingBox())!;
    const barBox = (await page.locator('.tabbar').boundingBox())!;
    expect(stripBox.y + stripBox.height).toBeLessThanOrEqual(barBox.y);
    const editor = (await page.locator('.editor').boundingBox())!;
    expect(editor.y + editor.height).toBe(852);
    await act(page, 'enter');
    await act(page, 'enter');
    await expect(page.locator('.strip-bar')).toBeHidden();
  });

  test('suggestions skip related exercises', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await page.clock.setFixedTime(new Date(2026, 10, 22, 10, 0, 0));
    await seed(page, readFixture());
    await focusEnd(page);
    await act(page, 'enter');
    await expectGhost(page, null);
    await act(page, 'type:C');
    await expectGhost(page, 'alf raise machine');
  });

  test('tap flash on empty space only', async ({ page }) => {
    await open(page);
    await page.touchscreen.tap(196, 400);
    await expect(page.locator('.tap-flash:not(.is-ring)')).toHaveCount(1);
    await expect(page.locator('.tap-flash.is-ring')).toHaveCount(2);
    const ring = (await page.locator('.tap-flash.is-ring').first().boundingBox())!;
    expect(Math.abs(ring.x + ring.width / 2 - 196)).toBeLessThanOrEqual(2);
    expect(Math.abs(ring.y + ring.height / 2 - 400)).toBeLessThanOrEqual(2);
    await expect(page.locator('.tap-flash')).toHaveCount(0, { timeout: 1500 });
    await act(page, 'type:a');
    await expect.poll(() => stored(page)).toBe('a');
  });

  test('holding on empty space ripples once, before letting go', async ({ page }) => {
    await open(page);
    await page.mouse.move(196, 400);
    await page.mouse.down();
    await expect(page.locator('.tap-flash.is-ring')).toHaveCount(2);
    await expect(page.locator('.tap-flash')).toHaveCount(0, { timeout: 1500 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    await expect(page.locator('.tap-flash')).toHaveCount(0);
  });

  test('hold on the tab bar and slide to pick another tab', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    const from = (await page.locator('.tabbar [data-action=dashboard]').boundingBox())!;
    const to = (await page.locator('.tabbar [data-action=settings]').boundingBox())!;
    const y = from.y + from.height / 2;
    await page.mouse.move(from.x + from.width / 2, y);
    await page.mouse.down();
    await expect(page.locator('.tab-pill')).toHaveClass(/is-on/);
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + from.width / 2 + ((to.x - from.x) * i) / 8, y);
    await expect(page.locator('.tabbar [data-action=settings]')).toHaveClass(/is-pressed/);
    await expect(page.locator('.tabbar [data-action=dashboard]')).not.toHaveClass(/is-pressed/);
    await page.waitForTimeout(250);
    const pill = (await page.locator('.tab-pill').boundingBox())!;
    expect(Math.abs(pill.x - to.x)).toBeLessThanOrEqual(1);
    await page.mouse.up();
    await page.locator('[data-action=exercises]').waitFor();
    await expect(page.locator('.sheet')).toHaveAttribute('aria-label', 'Settings');
    await expect(page.locator('.tab-pill')).not.toHaveClass(/is-on/);
  });

  test('sliding off the tab bar cancels', async ({ page }) => {
    await open(page);
    const tab = (await page.locator('.tabbar [data-action=dashboard]').boundingBox())!;
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
    await page.mouse.down();
    await page.mouse.move(tab.x + tab.width / 2, tab.y - 200, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  test('tapping into the log hides the bar at once, before the keyboard', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.touchscreen.tap(196, 300);
    await expect(page.locator('#app')).toHaveClass(/kb-pending/);
    await expect(page.locator('.tabbar')).toHaveCSS('opacity', '0');
    // No keyboard in the emulator: the bar comes back.
    await expect(page.locator('#app')).not.toHaveClass(/kb-pending/, { timeout: 2000 });
    await expect(page.locator('.tabbar')).toHaveCSS('opacity', '1');
  });

  test('tab bar sits low and settings steppers are large', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    const bar = (await page.locator('.tabbar').boundingBox())!;
    expect(852 - (bar.y + bar.height)).toBeLessThanOrEqual(8);
    await tapTab(page, 'settings');
    const step = (await page.locator('[data-setting="target"] [data-step="up"]').boundingBox())!;
    expect(step.width).toBeGreaterThanOrEqual(56);
    expect(step.height).toBeGreaterThanOrEqual(44);
  });

  test('no tap flash on text', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    const line = page.locator('.cm-line', { hasText: 'Hammer curls-75-4' }).last();
    const box = (await line.boundingBox())!;
    await page.touchscreen.tap(box.x + 10, box.y + box.height / 2);
    await page.waitForTimeout(100);
    await expect(page.locator('.tap-flash')).toHaveCount(0);
  });

  test('lint list shows fixes and applies them with Enter', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await seed(page, F);
    await tapTab(page, 'lint');
    await expect(page.locator('.lint-row')).toHaveCount(18);
    const card = page.locator('.lint-card');
    await expect(card.locator('.lint-msg')).toHaveText('Bad number');
    await expect(card.locator('.lint-fix-text')).toHaveText(FIXES[100]);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await expect(card.locator('.lint-num')).toHaveText('Line 192');
    await expect(card.locator('.lint-fix-text')).toHaveText('2/8');
    await expect(page.locator('.lint-row')).toHaveCount(17);
    await page.locator('[data-action=apply]').tap();
    await expect(card.locator('.lint-num')).toHaveText('Line 194');
    for (let i = 0; i < 16; i++) await page.keyboard.press('Enter');
    await expect(page.locator('.lint .empty')).toHaveText('No flags');
    await expect(page.locator('.tab-badge')).toBeHidden();
    await expect.poll(() => stored(page)).toBe(withFixes(F));

    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await tapTab(page, 'lint');
    await expect(page.locator('.lint .empty')).toHaveText('No flags');
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet')).toHaveCount(0);

    await page.locator('.cm-content').focus();
    await page.keyboard.press('Meta+z');
    await expect.poll(() => stored(page)).toBe(withFixes(F, [1424]));
    expect((await stored(page))!.split('\n')[1423]).toBe('Legs-405-2/365-6/365-3/');
  });

  test('lint edit puts the cursor on the line in the log', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    const F = readFixture();
    await seed(page, F);
    await tapTab(page, 'lint');
    await page.locator('.lint-row[data-line="823"]').tap();
    await expect(page.locator('.lint-card .lint-num')).toHaveText('Line 823');
    await page.locator('[data-action=edit]').tap();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.type('X');
    await expect
      .poll(async () => ((await stored(page)) ?? '').split('\n')[822])
      .toBe(F.split('\n')[822] + 'X');
  });

  test('tapping the log closes the lint panel', async ({ page }) => {
    test.skip(!hasFixture, 'fixture not present');
    await seed(page, readFixture());
    await tapTab(page, 'lint');
    await page.locator('.lint-card').waitFor();
    await page.waitForTimeout(400);
    await page.locator('.cm-content').tap({ position: { x: 40, y: 10 } });
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  const states = [
    'bar only',
    'dashboard list',
    'dashboard detail',
    'dashboard list 1rm',
    'dashboard detail 1rm',
    'lint panel',
    'lint panel next',
    'settings root',
    'exercise page',
    'merged names page',
  ];
  for (const state of states) {
    test(`design guards, ${state}`, async ({ page }) => {
      test.skip(!hasFixture, 'fixture not present');
      await seed(page, readFixture());
      if (state.startsWith('dashboard')) {
        await tapTab(page, 'dashboard');
        await page.locator('.dash-row').first().waitFor();
      }
      if (state === 'dashboard list 1rm') {
        await page.locator('.dash-list [data-mode="1rm"]').tap();
        await expect(page.locator('.dash-row').first().locator('.dash-latest')).toHaveText('322');
      }
      if (state.startsWith('dashboard detail')) {
        await page.locator('.dash-row[data-key="bench"]').tap();
        await expect(page.locator('.readout-value')).toHaveText('290');
      }
      if (state === 'dashboard detail 1rm') {
        await page.locator('.dash-detail [data-mode="1rm"]').tap();
        await expect(page.locator('.readout-value')).toHaveText('322');
      }
      if (state.startsWith('lint')) {
        await tapTab(page, 'lint');
        await page.locator('.lint-card').waitFor();
      }
      if (state === 'lint panel next') {
        await page.locator('[data-action=next]').tap();
        await expect(page.locator('.lint-count')).toHaveText('2 of 18');
      }
      if (state.includes('settings') || state === 'exercise page' || state === 'merged names page') {
        await tapTab(page, 'settings');
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
          if (s.backgroundImage !== 'none') found.push(`${name} background-image ${s.backgroundImage}`);
          if (filter && filter !== 'none' && !e.classList.contains('glass')) found.push(`${name} backdrop-filter ${filter}`);
        }
        return found;
      });
      expect(bad).toEqual([]);
      const colors = await page.evaluate(() =>
        Array.from(document.querySelectorAll('svg *')).flatMap(e =>
          ['fill', 'stroke'].map(a => e.getAttribute(a)).filter((v): v is string => v !== null),
        ),
      );
      const allowed = new Set(['none', 'currentColor', '#F2F2F2', '#8A8A8A', '#262626', '#0A0A0A']);
      expect(colors.filter(c => !allowed.has(c))).toEqual([]);
      if (state.startsWith('dashboard detail')) expect(colors.length).toBeGreaterThan(0);
    });
  }
});
