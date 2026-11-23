import { mkdirSync } from 'node:fs';
import { expectGhost, hasFixture, open, readFixture, seed, test } from './helpers';

const dir = new URL('../../screenshots/', import.meta.url);

test('screenshot: empty', async ({ page }) => {
  mkdirSync(dir, { recursive: true });
  await open(page);
  await expectGhost(page, '11/23');
  await page.screenshot({ path: new URL('cp2-empty.png', dir).pathname.replace(/^\/(\w:)/, '$1'), scale: 'css' });
});

test('screenshot: mid entry', async ({ page }) => {
  test.skip(!hasFixture, 'fixture not present');
  mkdirSync(dir, { recursive: true });
  await seed(page, readFixture() + '\n\n11/23\nPush\nBench-290-4/');
  await expectGhost(page, '270');
  await page.screenshot({ path: new URL('cp2-mid-entry.png', dir).pathname.replace(/^\/(\w:)/, '$1'), scale: 'css' });
});
