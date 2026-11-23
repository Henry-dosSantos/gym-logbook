import {
  act,
  expect,
  expectGhost,
  hasFixture,
  open,
  readFixture,
  run,
  seed,
  stored,
  strip,
  test,
} from './helpers';
import type { Step } from './helpers';

const PREFIX: Step[] = ['enter', 'enter', 'enter', 'enter', 'type:P', 'enter', 'enter'];

const BENCH_STRIP = [
  ['11/21', '290-3/270-5/245-9'],
  ['11/13', '290-3/265-6'],
];

test.describe('with the real log', () => {
  test.skip(!hasFixture, 'fixture not present');

  test('P alternates push and pull', async ({ page }) => {
    await seed(page, readFixture() + '\n\n11/23\nPush\nBench-290-4/\n\n11/24\n');
    await page.locator('.cm-content').focus();
    await page.keyboard.press('ControlOrMeta+End');
    await run(page, [['type:P', 'ull']]);
  });

  test('full new entry', async ({ page }) => {
    const F = readFixture();
    await seed(page, F);
    await expectGhost(page, null);
    expect(await strip(page)).toEqual([
      ['11/18', '75-5/70-5'],
      ['11/12', '75-6/75-4/70-6'],
    ]);

    const steps: [Step, string | null][] = [
      ['enter', null],
      ['enter', '11/23'],
      ['enter', null],
      ['enter', null],
      ['type:P', 'ush'],
      ['enter', null],
      ['enter', 'Bench'],
      ['enter', '-290'],
    ];
    await run(page, steps);
    expect(await strip(page)).toEqual(BENCH_STRIP);

    await run(page, [
      ['enter', '-'],
      ['type:-', null],
      ['type:4', '/'],
      ['space', '270'],
      ['space', '-'],
      ['space', null],
      ['type:5', '/'],
      ['type:/', '245'],
      ['enter', '-'],
      ['enter', null],
      ['type:9', '/'],
      ['enter', null],

      ['enter', 'Incline db'],
      ['enter', '-105'],
      ['enter', '-'],
      ['enter', null],
      ['type:5', '/'],
      ['space', null],

      ['enter', 'Db lat raise'],
      ['enter', '-40'],
      ['enter', '-'],
      ['enter', null],
      ['type:9', '/'],
      ['space', '40'],
      ['enter', '-'],
      ['enter', null],
      ['type:8', '/'],
      ['space', null],

      ['enter', 'Tricep pushdowns'],
      ['enter', '-max'],
      ['enter', '-'],
      ['enter', null],
      ['type:8', '/'],
      ['space', 'max'],
      ['space', '-'],
      ['space', null],
      ['type:7', '/'],
      ['space', 'max'],
      ['enter', '-'],
      ['enter', null],
      ['type:6', '/'],
      ['space', null],

      ['enter', null],
    ]);

    await expect
      .poll(() => stored(page))
      .toBe(
        F +
          '\n\n11/23\nPush\nBench-290-4/270-5/245-9/\nIncline db-105-5/\nDb lat raise-40-9/40-8/\nTricep pushdowns-max-8/max-7/max-6/\n',
      );
  });

  test('undo removes only the acceptance', async ({ page }) => {
    const F = readFixture();
    await seed(page, F);
    for (const s of [...PREFIX, 'enter'] as Step[]) await act(page, s);
    await expect.poll(() => stored(page)).toBe(F + '\n\n11/23\nPush\nBench');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => stored(page)).toBe(F + '\n\n11/23\nPush\n');
    await expectGhost(page, 'Bench');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => stored(page)).toBe(F + '\n\n11/23\nPush\nBench');
  });

  test('skip a prediction', async ({ page }) => {
    const F = readFixture();
    const S = F + '\n\n11/23\nPush\n';
    const toPrefix = async () => {
      await seed(page, F);
      for (const s of PREFIX) await act(page, s);
      await expectGhost(page, 'Bench');
      await expect.poll(() => stored(page)).toBe(S);
    };

    await toPrefix();
    await run(page, [['backspace', null]]);
    expect(await stored(page)).toBe(S);
    await run(page, [['enter', null]]);
    await expect.poll(() => stored(page)).toBe(S + '\n');
    await run(page, [['type:B', 'ench']]);

    await toPrefix();
    await run(page, [
      ['backspace', null],
      ['backspace', null],
    ]);
    await expect.poll(() => stored(page)).toBe(S.slice(0, -1));

    await toPrefix();
    await run(page, [
      ['backspace', null],
      ['type:X', null],
      ['backspace', 'Bench'],
    ]);
    await expect.poll(() => stored(page)).toBe(S);

    await seed(page, F);
    await run(page, [
      ['enter', null],
      ['enter', '11/23'],
      ['backspace', null],
    ]);
    await expect.poll(() => stored(page)).toBe(F + '\n\n');
    await act(page, 'enter');
    await expect.poll(() => stored(page)).toBe(F + '\n\n\n');

    await toPrefix();
    await run(page, [['enter', '-290']]);
    await act(page, 'backspace');
    await expect.poll(() => stored(page)).toMatch(/Push\nBenc$/);
  });

  test('ghost details', async ({ page }) => {
    const F = readFixture();
    const base = F + '\n\n11/23\nPush\n';
    const toPrefix = async () => {
      await seed(page, F);
      for (const s of PREFIX) await act(page, s);
      await expectGhost(page, 'Bench');
    };

    await toPrefix();
    await run(page, [
      ['type:X', null],
      ['backspace', 'Bench'],
    ]);

    await toPrefix();
    await run(page, [['space', null]]);
    await expect.poll(() => stored(page)).toBe(base + ' ');
    await run(page, [['backspace', 'Bench']]);

    await toPrefix();
    await run(page, [['enter', '-290']]);
    await act(page, 'space');
    await expect.poll(() => stored(page)).toBe(base + 'Bench ');

    await toPrefix();
    await run(page, [
      ['type:Be', 'nch'],
      ['type:n', 'ch'],
      ['type:ch', '-290'],
    ]);
  });
});

test('empty document', async ({ page }) => {
  await open(page);
  await expectGhost(page, '11/23');
  expect(await stored(page)).toBeUndefined();
  await page.keyboard.press('Enter');
  await expect.poll(() => stored(page)).toBe('11/23');
});

test('persistence', async ({ page }) => {
  await open(page);
  await page.keyboard.type('abc');
  await expect.poll(() => stored(page)).toBe('abc');
  await page.reload();
  await page.locator('.cm-content').waitFor();
  await page.keyboard.type('X');
  await expect.poll(() => stored(page)).toBe('abcX');
});

test('editor attributes and metrics', async ({ page }) => {
  await open(page);
  const content = page.locator('.cm-content');
  await expect(content).toHaveAttribute('autocorrect', 'off');
  await expect(content).toHaveAttribute('spellcheck', 'false');
  await expect(content).toHaveAttribute('autocapitalize', 'sentences');
  const style = await content.evaluate(el => {
    const s = getComputedStyle(el);
    return { size: parseFloat(s.fontSize), family: s.fontFamily };
  });
  expect(style.size).toBeGreaterThanOrEqual(16);
  expect(style.size).toBe(17);
  expect(style.family.replace(/["']/g, '')).toMatch(/^IBM Plex Mono/);
  expect(await page.locator('.cm-gutters').count()).toBe(0);
  expect(await page.locator('.cm-activeLine').count()).toBe(0);
  for (const action of ['dash', 'slash', 'accept', 'newline']) {
    expect(await page.locator(`[data-action="${action}"]`).count()).toBe(0);
  }
  expect(await page.locator('.strip').count()).toBe(1);
  const fontOk = await page.evaluate(async () => {
    await document.fonts.load('17px "IBM Plex Mono"');
    await document.fonts.ready;
    return document.fonts.check('17px "IBM Plex Mono"');
  });
  expect(fontOk).toBe(true);
});

test('ghost leaves the editable DOM untouched on an empty page', async ({ page }) => {
  await open(page);
  await expectGhost(page, '11/23');
  const info = await page.evaluate(() => {
    const content = document.querySelector('.cm-content')!;
    const lines = content.querySelectorAll('.cm-line');
    const line = lines[0] as HTMLElement;
    const after = getComputedStyle(line, '::after');
    const sel = getSelection()!;
    return {
      lines: lines.length,
      locked: content.querySelectorAll('[contenteditable="false"]').length,
      imgs: content.querySelectorAll('img').length,
      ghosts: content.querySelectorAll('.cm-ghost').length,
      children: Array.from(line.children).map(c => c.tagName),
      height: line.getBoundingClientRect().height,
      content: after.content,
      color: after.color,
      position: after.position,
      collapsed: sel.isCollapsed,
      anchorInLine: line.contains(sel.anchorNode),
      offset: sel.anchorOffset,
    };
  });
  expect(info.lines).toBe(1);
  expect(info.locked).toBe(0);
  expect(info.imgs).toBe(0);
  expect(info.ghosts).toBe(0);
  expect(info.children).toEqual(['BR']);
  expect(info.height).toBeLessThanOrEqual(27);
  expect(info.content).toBe('"11/23"');
  expect(info.color).toBe('rgba(242, 242, 242, 0.3)');
  expect(info.position).toBe('absolute');
  expect(info.collapsed).toBe(true);
  expect(info.anchorInLine).toBe(true);
  expect(info.offset).toBe(0);
});

test.describe('ghost on a filled line', () => {
  test.skip(!hasFixture, 'fixture not present');

  test('is not part of the DOM text', async ({ page }) => {
    await seed(page, readFixture());
    for (const s of [...PREFIX, 'enter'] as Step[]) await act(page, s);
    await expectGhost(page, '-290');
    const info = await page.evaluate(() => {
      const content = document.querySelector('.cm-content')!;
      const line = content.querySelector('.cm-ghost-line') as HTMLElement;
      return {
        cls: line.className,
        position: getComputedStyle(line, '::after').position,
        text: line.textContent,
        locked: content.querySelectorAll('[contenteditable="false"]').length,
        imgs: content.querySelectorAll('img').length,
      };
    });
    expect(info.cls).toContain('cm-ghost-line');
    expect(info.cls).not.toContain('cm-ghost-empty');
    expect(info.position).toBe('static');
    expect(info.text).toBe('Bench');
    expect(info.locked).toBe(0);
    expect(info.imgs).toBe(0);
  });
});

test('long last line raises no errors', async ({ page }) => {
  await seed(page, 'x'.repeat(60));
  await page.keyboard.type('y');
  await page.waitForTimeout(300);
});
