import type { Page } from '@playwright/test';
import {
  act,
  closeByScrim,
  expect,
  expectGhost,
  focusEnd,
  hasFixture,
  readFixture,
  run,
  seed,
  storedSettings,
  strip,
  tapTab,
  test,
} from './helpers';
import type { Step } from './helpers';

const PREFIX: Step[] = ['enter', 'enter', 'enter', 'enter', 'type:P', 'enter', 'enter'];

const TOP = '.sheet .stack-page:last-child';

async function openSettings(page: Page): Promise<void> {
  await tapTab(page, 'settings');
  await page.locator('[data-action=exercises]').waitFor();
}

async function step(page: Page, setting: 'target' | 'increment', dir: 'up' | 'down', times = 1): Promise<void> {
  const button = page.locator(`${TOP} [data-setting="${setting}"] [data-step="${dir}"]`);
  for (let i = 0; i < times; i++) await button.tap();
}

const value = (page: Page, setting: 'target' | 'increment') =>
  page.locator(`${TOP} [data-setting="${setting}"] .stepper-value`);

async function benchGhost(page: Page): Promise<void> {
  await focusEnd(page);
  for (const s of [...PREFIX, 'enter'] as Step[]) await act(page, s);
}

test.describe('settings', () => {
  test.skip(!hasFixture, 'fixture not present');

  test.beforeEach(async ({ page }) => {
    await seed(page, readFixture());
  });

  test('root page and global rule', async ({ page }) => {
    await openSettings(page);
    const sheet = (await page.locator('.sheet').boundingBox())!;
    expect(sheet.height).toBeGreaterThan(800);
    await expect(page.locator(`${TOP} .section-label`)).toHaveText(['Progression', 'Exercises', 'Names']);
    const footer = page.locator('[data-footer="progression"]');
    await expect(footer).toHaveText(
      'When set 1 hits 4 reps or more at the same weight two sessions in a row, the next suggestion goes up 5 lb.',
    );
    await expect(value(page, 'target')).toHaveText('4');
    await expect(value(page, 'increment')).toHaveText('5 lb');

    await step(page, 'target', 'up');
    await expect(value(page, 'target')).toHaveText('5');
    await expect(footer).toContainText('hits 5 reps');
    await expect.poll(async () => (await storedSettings(page))?.defaults?.target).toBe(5);

    await step(page, 'target', 'down', 2);
    await expect(value(page, 'target')).toHaveText('3');
    await closeByScrim(page);
    await benchGhost(page);
    await expectGhost(page, '-295');

    await page.reload();
    await page.locator('.cm-content').waitFor();
    await openSettings(page);
    await expect(value(page, 'target')).toHaveText('3');
  });

  test('global step', async ({ page }) => {
    await openSettings(page);
    await step(page, 'target', 'down');
    await step(page, 'increment', 'up', 2);
    await expect(value(page, 'target')).toHaveText('3');
    await expect(value(page, 'increment')).toHaveText('10 lb');
    await closeByScrim(page);
    await benchGhost(page);
    await expectGhost(page, '-300');
  });

  test('custom rule', async ({ page }) => {
    await openSettings(page);
    await page.locator('[data-action=exercises]').tap();
    await page.locator('.nav-row[data-key="incline db"]').tap();
    await expect(page.locator(`${TOP} .page-title`)).toHaveText('Incline db');
    await step(page, 'increment', 'up', 2);
    await expect(value(page, 'increment')).toHaveText('10 lb');
    await expect(page.locator('[data-footer="exercise"]')).toHaveText(
      'Incline db goes up 10 lb after two sessions in a row at 4 reps or more.',
    );
    await page.locator(`${TOP} [data-action=back]`).tap();
    await expect(page.locator('.nav-row[data-key="incline db"] .nav-value')).toHaveText('+10 lb');
    await page.locator(`${TOP} [data-action=back]`).tap();
    await expect(page.locator('[data-action=exercises] .nav-value')).toHaveText('1');
    await closeByScrim(page);

    await focusEnd(page);
    for (const s of PREFIX) await act(page, s);
    await act(page, 'type:Incline db');
    await expectGhost(page, '-110');

    await openSettings(page);
    await page.locator('[data-action=exercises]').tap();
    await page.locator('.nav-row[data-key="incline db"]').tap();
    await page.locator(`${TOP} [data-action=reset]`).tap();
    await expect(value(page, 'target')).toHaveText('4');
    await expect(value(page, 'increment')).toHaveText('5 lb');
    await expect(page.locator(`${TOP} [data-action=reset]`)).toBeHidden();
    await expect.poll(async () => 'incline db' in ((await storedSettings(page))?.exercises ?? {})).toBe(false);
  });

  test('reset all custom rules', async ({ page }) => {
    await openSettings(page);
    await page.locator('[data-action=exercises]').tap();
    await expect(page.locator(`${TOP} [data-action=reset-all]`)).toBeHidden();
    await page.locator('.nav-row[data-key="incline db"]').tap();
    await expect(page.locator(`${TOP} [data-action=reset]`)).toBeHidden();
    await step(page, 'increment', 'up', 2);
    await expect(page.locator(`${TOP} [data-action=reset]`)).toHaveText('Reset to default');
    await page.locator(`${TOP} [data-action=back]`).tap();
    await page.waitForTimeout(450);

    const resetAll = page.locator(`${TOP} [data-action=reset-all]`);
    await expect(resetAll).toHaveText('Reset all to default');
    await resetAll.tap();
    await expect(page.locator(`${TOP} .confirm-text`)).toHaveText('Reset every custom rule?');
    await expect(resetAll).toBeHidden();
    await page.locator(`${TOP} [data-action=cancel-reset]`).tap();
    await expect(page.locator(`${TOP} .confirm-text`)).toBeHidden();
    await expect(page.locator('.nav-row[data-key="incline db"] .nav-value')).toHaveText('+10 lb');

    await resetAll.tap();
    await page.locator(`${TOP} [data-action=confirm-reset]`).tap();
    await expect.poll(async () => (await storedSettings(page))?.exercises).toEqual({});
    await expect(page.locator(`${TOP} .nav-value.bright`).filter({ hasText: /./ })).toHaveCount(0);
    await expect(resetAll).toBeHidden();
    await expect(page.locator(`${TOP} .confirm-text`)).toBeHidden();
  });

  test('merged names', async ({ page }) => {
    await openSettings(page);
    await page.locator('[data-action=names]').tap();
    const groups = page.locator(`${TOP} [data-group]`);
    await expect(groups).toHaveCount(9);
    await expect(groups.first()).toContainText('Incline DB');
    await expect(groups.first()).toContainText('Incline DB press, Incline dumbbell press');

    await page.locator(`${TOP} [data-action=new-group]`).tap();
    await page.locator(`${TOP} [data-action=add-name]`).tap();
    const picks = page.locator(`${TOP} .row[data-name]`);
    await expect(picks.first()).toBeVisible();
    const names = await picks.evaluateAll(rows => rows.map(r => (r as HTMLElement).dataset.name));
    expect(names).toContain('Chin ups');
    expect(names).toContain('Weighted chin ups');
    expect(names).not.toContain('Flat bench');

    await page.locator(`${TOP} .row[data-name="Chin ups"]`).tap();
    await expect(page.locator(`${TOP} .name-list [data-name]`)).toHaveCount(1);
    await page.locator(`${TOP} [data-action=add-name]`).tap();
    await page.locator(`${TOP} .row[data-name="Weighted chin ups"]`).tap();
    await expect(page.locator(`${TOP} .name-list [data-name]`)).toHaveCount(2);
    await closeByScrim(page);

    await expect.poll(async () => (await storedSettings(page))?.aliases?.length).toBe(10);
    const aliases = (await storedSettings(page)).aliases as string[][];
    expect(aliases[aliases.length - 1]).toEqual(['Chin ups', 'Weighted chin ups']);

    await focusEnd(page);
    await act(page, 'enter');
    await act(page, 'type:Chin ups');
    await expectGhost(page, '-190');
    expect(await strip(page)).toEqual([
      ['11/18', '190-3/160-4/145-4'],
      ['11/12', '180-3/135-5'],
    ]);

    await openSettings(page);
    await page.locator('[data-action=names]').tap();
    await page.locator(`${TOP} [data-group="9"]`).tap();
    await page.locator(`${TOP} [data-name="Weighted chin ups"] [data-action=remove]`).tap();
    await closeByScrim(page);
    await expect.poll(async () => (await storedSettings(page))?.aliases?.length).toBe(9);
  });
});
