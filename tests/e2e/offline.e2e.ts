import { expect, expectGhost, hasFixture, open, readFixture, seed, stored, test } from './helpers';

test('works offline after the first load', async ({ page, context }) => {
  test.skip(!hasFixture, 'fixture not present');
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const F = readFixture();
  await seed(page, F);
  await context.setOffline(true);
  await page.reload();
  await page.locator('.cm-content').waitFor();
  expect(await stored(page)).toBe(F);
  await page.locator('[data-action=newline]').tap();
  await expectGhost(page, 'Chin ups');
});
