import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDoc } from '../../src/core/parse';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { dashboardItems, exerciseSeries, metricPoints } from '../../src/core/stats';

const aliases = DEFAULT_SETTINGS.aliases;
const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);

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
});

describe.skipIf(!existsSync(fixturePath))('dashboardItems', () => {
  const items = dashboardItems(parseDoc(existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : ''), aliases);

  it('summarizes bench', () => {
    const bench = items[0];
    expect(bench.key).toBe('bench');
    expect(bench.sessions).toBe(59);
    expect(bench.metric).toBe('weight');
    expect(bench.values).toHaveLength(59);
    expect(bench.values[0]).toBe(225);
    expect(bench.latest).toBe(290);
    expect(Math.max(...bench.values)).toBe(315);
  });

  it('picks reps for max-weight exercises and skips thin ones', () => {
    expect(items.find(i => i.key === 'leg extensions')!.metric).toBe('reps');
    expect(items.find(i => i.key === 'leg curls')!.metric).toBe('weight');
    expect(items.some(i => i.key === 'lat pull downs')).toBe(false);
  });
});
