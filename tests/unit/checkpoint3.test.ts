import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entryText } from '../../src/core/history';
import { parseDoc } from '../../src/core/parse';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { defaultTarget, exerciseList } from '../../src/core/suggest';
import type { Session } from '../../src/core/history';
import { exportFiles } from '../../src/export';

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);
const hasFixture = existsSync(fixturePath);

const sessionWith = (reps: (number | null)[]): Session[] =>
  reps.map(r => ({ entry: null as never, sets: [{ weight: 100, pair: false, reps: r, seconds: null }], setsText: '' }));

describe('exportFiles', () => {
  it('names and types the files', () => {
    const files = exportFiles('abc', DEFAULT_SETTINGS, new Date(2026, 10, 3));
    expect(files.map(f => [f.name, f.type])).toEqual([
      ['logbook-2026-11-03.txt', 'text/plain'],
      ['logbook-settings.json', 'application/json'],
    ]);
    expect(files[0].content).toBe('abc');
    expect(JSON.parse(files[1].content)).toEqual(DEFAULT_SETTINGS);
  });

  it.skipIf(!hasFixture)('keeps the fixture bytes', () => {
    const F = readFileSync(fixturePath, 'utf8');
    const files = exportFiles(F, DEFAULT_SETTINGS, new Date(2026, 10, 3));
    expect(Buffer.from(new TextEncoder().encode(files[0].content)).equals(readFileSync(fixturePath))).toBe(true);
  });
});

describe('entryText', () => {
  it('excludes trailing blank lines', () => {
    const text = '1/1\nPush\nBench-1-1/\n\n\n1/2\nPull\nRows-1-1/\n\n\n';
    const doc = parseDoc(text);
    expect(entryText(doc, 5)).toBe('1/1\nPush\nBench-1-1/');
    expect(entryText(doc, text.length)).toBe('1/2\nPull\nRows-1-1/');
  });

  it('uses the last entry before the first date', () => {
    const doc = parseDoc('Gym 2026\n1/1\nPush\n\n1/2\nPull');
    expect(entryText(doc, 0)).toBe('1/2\nPull');
  });

  it('is null without entries', () => {
    expect(entryText(parseDoc(''), 0)).toBeNull();
  });

  it.skipIf(!hasFixture)('finds the last fixture entry', () => {
    const F = readFileSync(fixturePath, 'utf8');
    expect(entryText(parseDoc(F), F.length)).toBe(
      '11/22\nPull\nWeighted chin ups-200-2/180-4/\nUnderhand rows-370-6/370-6/370-5/\nHammer curls-75-4/70-5/',
    );
  });
});

describe('defaultTarget', () => {
  it('uses the median of set-one reps', () => {
    expect(defaultTarget(sessionWith([8, 8, 8]))).toBe(10);
    expect(defaultTarget(sessionWith([7, 8]))).toBe(4);
    expect(defaultTarget(sessionWith([null]))).toBe(4);
    expect(defaultTarget([])).toBe(4);
  });
});

describe.skipIf(!hasFixture)('exerciseList', () => {
  const list = exerciseList(parseDoc(hasFixture ? readFileSync(fixturePath, 'utf8') : ''), DEFAULT_SETTINGS.aliases);

  it('lists usable exercises', () => {
    expect(list).toContainEqual({ key: 'bench', name: 'Bench', sessions: 59, target: 4 });
    expect(list).toContainEqual({ key: 'calf raises', name: 'Calf raises', sessions: 35, target: 10 });
    expect(list.some(x => x.key === 'lat pull downs')).toBe(false);
    expect(list[0].key).toBe('bench');
  });
});
