import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

export const fixturePath = fileURLToPath(new URL('../fixtures/gym-2026.txt', import.meta.url));
export const hasFixture = existsSync(fixturePath);
export const readFixture = (): string => readFileSync(fixturePath, 'utf8');

export const test = base.extend({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', m => {
      if (m.type() === 'error') problems.push(`console: ${m.text()}`);
    });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    await page.clock.setFixedTime(new Date(2026, 10, 23, 10, 0, 0));
    await use(page);
    expect(problems).toEqual([]);
  },
});

export { expect };

const IDB_READ = (key: string) =>
  new Promise<unknown>((resolve, reject) => {
    const req = indexedDB.open('logbook', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const get = req.result.transaction('kv').objectStore('kv').get(key);
      get.onsuccess = () => {
        req.result.close();
        resolve(get.result);
      };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });

export async function open(page: Page): Promise<void> {
  await page.goto('./');
  await page.locator('.cm-content').waitFor();
}

export async function seed(page: Page, text: string): Promise<void> {
  await open(page);
  await page.evaluate(
    t =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('logbook', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(t, 'text');
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    text,
  );
  await page.reload();
  await page.locator('.cm-content').waitFor();
}

export const stored = (page: Page): Promise<string | undefined> =>
  page.evaluate(IDB_READ, 'text') as Promise<string | undefined>;

export const storedSettings = (page: Page): Promise<any> => page.evaluate(IDB_READ, 'settings');

export async function ghost(page: Page): Promise<string | null> {
  const el = page.locator('.cm-ghost');
  return (await el.count()) === 0 ? null : await el.first().textContent();
}

export async function expectGhost(page: Page, expected: string | null): Promise<void> {
  await expect.poll(() => ghost(page), { message: `ghost should be ${JSON.stringify(expected)}` }).toBe(expected);
}

export async function strip(page: Page): Promise<string[][]> {
  return page.locator('.strip-item').evaluateAll(items =>
    items.map(i => [i.querySelector('.strip-date')!.textContent!, i.querySelector('.strip-sets')!.textContent!]),
  );
}

export type Step = 'enter' | 'space' | 'backspace' | `type:${string}` | `tap:${string}`;

export async function act(page: Page, step: Step): Promise<void> {
  if (step === 'enter') await page.keyboard.press('Enter');
  else if (step === 'space') await page.keyboard.press('Space');
  else if (step === 'backspace') await page.keyboard.press('Backspace');
  else if (step.startsWith('type:')) await page.keyboard.type(step.slice(5));
  else await page.locator(`[data-action=${step.slice(4)}]`).tap();
}

export async function run(page: Page, steps: [Step, string | null][]): Promise<void> {
  for (const [step, expected] of steps) {
    await act(page, step);
    try {
      await expectGhost(page, expected);
    } catch (e) {
      throw new Error(`after step "${step}" expected ghost ${JSON.stringify(expected)}, got ${JSON.stringify(await ghost(page))}`, {
        cause: e,
      });
    }
  }
}

export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (t: string) => {
          (window as unknown as { __copied: string }).__copied = t;
          return Promise.resolve();
        },
      },
    });
  });
}

export const copied = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => (window as unknown as { __copied?: string }).__copied);

export async function openMenu(page: Page): Promise<void> {
  await page.locator('[data-action=menu]').tap();
  await page.locator('.sheet').waitFor();
}

export async function tapRow(page: Page, action: string): Promise<void> {
  await page.locator(`.sheet [data-action=${action}]`).tap();
}

export async function closeByScrim(page: Page): Promise<void> {
  await page.locator('.scrim').tap({ position: { x: 10, y: 3 } });
  await expect(page.locator('.sheet')).toHaveCount(0);
}

export async function focusEnd(page: Page): Promise<void> {
  await page.locator('.cm-content').focus();
  await page.keyboard.press('ControlOrMeta+End');
}
