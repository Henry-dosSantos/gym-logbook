import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estimate1RM } from '../../src/core/onerm';
import { parseDoc } from '../../src/core/parse';
import { DEFAULT_SETTINGS, clearAllExerciseRules } from '../../src/core/settings';
import { dashboardItems, exerciseSeries, metricPoints } from '../../src/core/stats';

const aliases = DEFAULT_SETTINGS.aliases;
const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);

describe('estimate1RM', () => {
  it.each([
    [290, 3, 316.04],
    [270, 5, 314.77],
    [245, 9, 321.55],
  ])('(%i, %i)', (w, r, expected) => {
    expect(estimate1RM(w, r)).toBeCloseTo(expected, 1);
  });

  it('returns the weight for a single', () => {
    expect(estimate1RM(300, 1)).toBe(300);
  });

  it.each([
    [300, 0],
    [300, 0.5],
    [0, 5],
  ])('rejects (%i, %f)', (w, r) => {
    expect(estimate1RM(w, r)).toBeNull();
  });

  it('interpolates fractional reps', () => {
    const mid = estimate1RM(225, 3.5)!;
    expect(mid).toBeGreaterThan(estimate1RM(225, 3)!);
    expect(mid).toBeLessThan(estimate1RM(225, 4)!);
  });
});

describe('exerciseSeries', () => {
  const doc = parseDoc('1/1\nPush\nBench-225-3/\n\n1/2\nPush\nBench-max-9/\n\n1/3\nPush\nBench-230-/');
  const series = exerciseSeries(doc, 'bench', aliases);

  it('reads set one of each session', () => {
    expect(series.map(p => p.weight)).toEqual([225, null, 230]);
    expect(series.map(p => p.max)).toEqual([false, true, false]);
    expect(series.map(p => p.reps)).toEqual([3, 9, null]);
  });

  it('filters by metric', () => {
    expect(metricPoints(series, 'weight')).toHaveLength(2);
    expect(metricPoints(series, 'reps')).toHaveLength(2);
  });

  it('estimates from the best set', () => {
    const d = parseDoc('1/1\nPush\nBench-290-3/270-5/245-9/\n\n1/2\nPush\nBench-max-9/');
    const s = exerciseSeries(d, 'bench', aliases);
    expect(s[0].oneRm).toBeCloseTo(321.55, 1);
    expect(s[0].oneRmFrom).toEqual({ weight: 245, reps: 9 });
    expect(s[1].oneRm).toBeNull();
  });
});

describe('dashboard latestText', () => {
  const latest = (text: string) =>
    dashboardItems(parseDoc(`1/1\nPush\nBench-100-5/\n\n1/2\nPush\n${text}`), aliases)[0].latestText;

  it.each([
    ['Bench-290-3/', '290 × 3'],
    ['Bench-max-10/', 'max × 10'],
    ['Bench-290-/', '290'],
    ['Bench-10/', '× 10'],
  ])('%s', (text, expected) => {
    expect(latest(text)).toBe(expected);
  });
});

describe('settings', () => {
  it('clears every exercise rule without mutating', () => {
    const s = { ...DEFAULT_SETTINGS, exercises: { bench: { target: 5 } } };
    const copy = structuredClone(s);
    expect(clearAllExerciseRules(s).exercises).toEqual({});
    expect(s).toEqual(copy);
  });
});

describe.skipIf(!existsSync(fixturePath))('dashboardItems on the fixture', () => {
  const items = dashboardItems(parseDoc(existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : ''), aliases);

  it('summarizes bench', () => {
    const bench = items[0];
    expect(bench.key).toBe('bench');
    expect(bench.sessions).toBe(59);
    expect(bench.latestText).toBe('290 × 3');
    expect(Math.round(bench.oneRmLatest!)).toBe(322);
    expect(bench.spark).toHaveLength(59);
    expect(bench.spark[0]).toBe(225);
  });

  it('handles max-weight exercises', () => {
    const legExt = items.find(i => i.key === 'leg extensions')!;
    expect(legExt.latestText).toBe('max × 10');
    expect(legExt.oneRmSpark.filter(v => v !== null).length).toBe(3);
    expect(items.some(i => i.key === 'lat pull downs')).toBe(false);
  });
});
