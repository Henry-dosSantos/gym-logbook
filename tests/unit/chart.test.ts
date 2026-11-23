import { describe, expect, it } from 'vitest';
import { chartGeometry, nearestIndex } from '../../src/core/chart';

const pad = { top: 10, right: 0, bottom: 10, left: 0 };

describe('chartGeometry', () => {
  it('maps values to points', () => {
    const g = chartGeometry([100, 200, 150], 300, 100, pad);
    expect(g.points).toEqual([{ x: 0, y: 90 }, { x: 150, y: 10 }, { x: 300, y: 50 }]);
    expect(g.path).toBe('M0 90L150 10L300 50');
    expect([g.min, g.max]).toEqual([100, 200]);
  });

  it('centers a flat series', () => {
    const g = chartGeometry([5, 5], 100, 100, pad);
    expect(g.points.map(p => p!.y)).toEqual([50, 50]);
  });

  it('centers a single value', () => {
    expect(chartGeometry([7], 100, 100, { top: 0, right: 0, bottom: 0, left: 0 }).points[0]!.x).toBe(50);
  });

  it('handles empty input', () => {
    expect(chartGeometry([], 100, 100, pad).path).toBe('');
  });

  it('leaves gaps for null values', () => {
    const g = chartGeometry([100, null, 200, 150], 300, 100, pad);
    expect(g.points).toEqual([{ x: 0, y: 90 }, null, { x: 200, y: 10 }, { x: 300, y: 50 }]);
    expect(g.path).toBe('M0 90M200 10L300 50');
    expect([g.min, g.max]).toEqual([100, 200]);
  });

  it('handles all-null input', () => {
    const g = chartGeometry([null, null], 100, 100, pad);
    expect(g.path).toBe('');
    expect(g.points).toEqual([null, null]);
  });
});

describe('nearestIndex', () => {
  const points = [{ x: 0 }, { x: 150 }, { x: 300 }];
  it.each([
    [74, 0],
    [80, 1],
    [75, 0],
    [-10, 0],
    [999, 2],
  ])('x = %i -> %i', (x, expected) => {
    expect(nearestIndex(points, x)).toBe(expected);
  });

  it('returns -1 for no points', () => {
    expect(nearestIndex([], 5)).toBe(-1);
  });

  it('skips null points', () => {
    const g = chartGeometry([100, null, 200, 150], 300, 100, pad);
    expect(nearestIndex(g.points, 90)).toBe(0);
    expect(nearestIndex(g.points, 110)).toBe(2);
    expect(nearestIndex(g.points, 260)).toBe(3);
  });
});
