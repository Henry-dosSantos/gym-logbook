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

const BENCH_STRIP = [
  ['11/21', '290-3/270-5/245-9'],
  ['11/13', '290-3/265-6'],
];

test.describe('with the real log', () => {
  test.skip(!hasFixture, 'fixture not present');

  test('full new entry', async ({ page }) => {
    const F = readFixture();
    await seed(page, F);
    await expectGhost(page, null);
    expect(await strip(page)).toEqual([
      ['11/18', '75-5/70-5'],
      ['11/12', '75-6/75-4/70-6'],
    ]);

    const steps: [Step, string | null][] = [
      ['tap:newline', 'Chin ups'],
      ['tap:newline', '11/23'],
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
      ['tap:dash', null],
      ['type:4', '/'],
      ['space', '270'],
      ['space', '-'],
      ['space', null],
      ['type:5', '/'],
      ['tap:slash', '245'],
      ['enter', '-'],
      ['enter', null],
      ['type:9', '/'],
      ['tap:accept', null],

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
    for (const s of ['tap:newline', 'tap:newline', 'enter', 'enter', 'type:P', 'enter', 'enter', 'enter'] as Step[]) {
      await act(page, s);
    }
    await expect.poll(() => stored(page)).toBe(F + '\n\n11/23\nPush\nBench');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => stored(page)).toBe(F + '\n\n11/23\nPush\n');
    await expectGhost(page, 'Bench');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => stored(page)).toBe(F + '\n\n11/23\nPush\nBench');
  });

  test('ghost details', async ({ page }) => {
    const base = readFixture() + '\n\n11/23\nPush\n';
    await seed(page, base);
    await expectGhost(page, 'Bench');
    await run(page, [
      ['type:X', null],
      ['backspace', 'Bench'],
    ]);
    await page.locator('[data-action=newline]').tap();
    await expect.poll(() => stored(page)).toBe(base + '\n');

    await seed(page, base);
    await run(page, [['enter', '-290']]);
    await act(page, 'space');
    await expect.poll(() => stored(page)).toBe(base + 'Bench ');

    await seed(page, base);
    await run(page, [
      ['type:Be', 'nch'],
      ['type:n', 'ch'],
      ['type:c', 'h'],
      ['type:h', '-290'],
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
  for (const b of await page.locator('.btn').all()) {
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const fontOk = await page.evaluate(async () => {
    await document.fonts.load('17px "IBM Plex Mono"');
    await document.fonts.ready;
    return document.fonts.check('17px "IBM Plex Mono"');
  });
  expect(fontOk).toBe(true);
});
