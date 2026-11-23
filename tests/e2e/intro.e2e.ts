import { expect, stored, test } from './helpers';

test.describe('launch intro', () => {
  test('the D glides together, then fades away without blocking the log', async ({ page }) => {
    await page.goto('./');
    const intro = page.locator('.intro');
    await expect(intro).toHaveCount(1);
    await expect(intro.locator('path')).toHaveCount(2);
    await expect(intro.locator('path').first()).toHaveAttribute('d', 'M25 12.5H37.5A37.5 37.5 0 0 1 37.5 87.5H25Z');
    const box = (await intro.boundingBox())!;
    expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 393, 852]);

    await page.locator('.cm-content').waitFor();
    await page.locator('.cm-content').focus();
    await page.keyboard.type('a');

    await expect(intro.locator('g').first()).toHaveAttribute('transform', 'translate(0 0)', { timeout: 2000 });
    await expect(intro.locator('path').first()).toHaveAttribute('fill-opacity', '1');
    await expect(intro).toHaveCount(0, { timeout: 1500 });
    await expect.poll(() => stored(page)).toBe('a');
  });

  test('reduced motion shows the finished mark, then removes it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    const intro = page.locator('.intro');
    await expect(intro.locator('g').last()).toHaveAttribute('transform', 'translate(0 0)');
    await expect(intro.locator('path').last()).toHaveAttribute('fill-opacity', '1');
    await expect(intro).toHaveCount(0, { timeout: 1000 });
  });
});
