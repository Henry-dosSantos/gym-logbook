import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { todayText } from '../../src/core/history';
import { parseDoc } from '../../src/core/parse';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { exerciseList } from '../../src/core/suggest';

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);
const hasFixture = existsSync(fixturePath);

const LAST_ENTRY =
  '11/22\nPull\nWeighted chin ups-200-2/180-4/\nUnderhand rows-370-6/370-6/370-5/\nHammer curls-75-4/70-5/';

describe('todayText', () => {
  const text = '1/1\nPush\nBench-1-1/\n\n1/2\nPull\nRows-1-1/\n\n';

  it('prefers the entry dated today', () => {
    expect(todayText(parseDoc(text), new Date(2026, 0, 1))).toBe('1/1\nPush\nBench-1-1/');
  });

  it('falls back to the last entry', () => {
    expect(todayText(parseDoc(text), new Date(2026, 0, 5))).toBe('1/2\nPull\nRows-1-1/');
  });

  it('is null without entries', () => {
    expect(todayText(parseDoc(''), new Date(2026, 0, 1))).toBeNull();
  });

  it.skipIf(!hasFixture)('uses the fixture entry', () => {
    const doc = parseDoc(readFileSync(fixturePath, 'utf8'));
    expect(todayText(doc, new Date(2026, 10, 22))).toBe(LAST_ENTRY);
    expect(todayText(doc, new Date(2026, 10, 23))).toBe(LAST_ENTRY);
  });
});

describe.skipIf(!hasFixture)('exerciseList', () => {
  const list = exerciseList(parseDoc(hasFixture ? readFileSync(fixturePath, 'utf8') : ''), DEFAULT_SETTINGS.aliases);

  it('lists usable exercises', () => {
    expect(list).toContainEqual({ key: 'bench', name: 'Bench', sessions: 59 });
    expect(list).toContainEqual({ key: 'calf raises', name: 'Calf raises', sessions: 35 });
    expect(list.some(x => x.key === 'lat pull downs')).toBe(false);
    expect(list[0].key).toBe('bench');
  });
});
