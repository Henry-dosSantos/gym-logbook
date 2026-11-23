import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { suggestFix } from '../../src/core/fix';
import { parseDoc } from '../../src/core/parse';

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);

describe('suggestFix synthetic', () => {
  it('rolls a backwards date into the next month', () => {
    const doc = parseDoc('Gym 2026\n12/30\nPush\n\n12/1\nPush\n');
    expect(doc.flags.map(f => [f.line, f.code])).toEqual([[5, 'date-backwards']]);
    expect(suggestFix(doc, doc.lines[4])).toBe('1/1');
  });

  it('keeps the rest of a date line', () => {
    const doc = parseDoc('8/31\nPush\n\n8/12 push at 11 pm\nBench-1-1/');
    expect(suggestFix(doc, doc.lines[3])).toBe('9/12 push at 11 pm');
  });

  it('offers nothing when no history matches', () => {
    const doc = parseDoc('1/1\nPush\nBench-225-5/\n\n1/2\nPush\n999-8/');
    expect(doc.flags.some(f => f.code === 'no-name')).toBe(true);
    expect(suggestFix(doc, doc.lines[6])).toBeNull();
  });
});

describe.skipIf(!existsSync(fixturePath))('suggestFix on the fixture', () => {
  const F = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : '';
  const doc = parseDoc(F);
  const fix = (n: number) => suggestFix(doc, doc.lines[n - 1]);

  it.each([
    [100, 'Back extensions-270-6/270-5/250-6/'],
    [192, '2/8'],
    [253, '2/22'],
    [424, '4/1'],
    [431, '4/2'],
    [438, '4/6'],
    [445, '4/7'],
    [452, '4/9'],
    [459, '4/11'],
    [466, '4/13'],
    [474, '4/15'],
    [823, 'Calf raises-465-14/465-14/465-12/'],
    [900, 'Calf raises-3x10-13/'],
    [1096, '9/1'],
    [1104, '9/3'],
  ])('line %i', (n, expected) => {
    expect(fix(n)).toBe(expected);
  });

  it.each([
    [194, 'Bench-250-8/250-6/225-8/'],
    [1372, 'Neutral pull ups-205-2/180-2/'],
    [1424, 'Rdls-405-2/365-6/365-3/'],
  ])('prediction for line %i', (n, expected) => {
    expect(fix(n)).toBe(expected);
  });

  it('clears every flag when all fixes are applied', () => {
    const lines = F.split('\n');
    for (const flagLine of new Set(doc.flags.map(f => f.line))) {
      const fixed = fix(flagLine);
      expect(fixed).not.toBeNull();
      lines[flagLine - 1] = fixed!;
    }
    expect(new Set(doc.flags.map(f => f.line)).size).toBe(18);
    expect(parseDoc(lines.join('\n')).flags).toEqual([]);
  });
});
