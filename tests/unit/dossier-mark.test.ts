import { describe, expect, it } from 'vitest';
import { dPath, introAt } from '../../src/core/dossier-mark';

describe('Dossier intro', () => {
  it('is already moving and partly visible on the first frame', () => {
    const f = introAt(0);
    expect(f.topX).toBeGreaterThan(-75);
    expect(f.topX).toBeLessThan(-60);
    expect(f.bottomX).toBe(-f.topX);
    expect(f.opacity).toBeGreaterThan(0);
    expect(f.opacity).toBeLessThan(0.5);
    expect(f.done).toBe(false);
  });

  it('is solid by about 0.11 s', () => {
    expect(introAt(0.09).opacity).toBeLessThan(1);
    expect(introAt(0.11).opacity).toBe(1);
  });

  it('slows down without overshooting and lands at 0.78 s', () => {
    let last = Infinity;
    for (let t = 0; t < 0.78; t += 0.01) {
      const x = introAt(t).bottomX;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(last);
      last = x;
    }
    expect(introAt(0.77).done).toBe(false);
    expect(introAt(0.79)).toEqual({ topX: -0, bottomX: 0, opacity: 1, done: true });
  });

  it('draws the D centred in the box', () => {
    expect(dPath()).toBe('M25 12.5H37.5A37.5 37.5 0 0 1 37.5 87.5H25Z');
  });
});
