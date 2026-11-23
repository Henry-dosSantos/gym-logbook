import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { related } from '../../src/core/history';
import { parseDoc } from '../../src/core/parse';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { suggest } from '../../src/core/suggest';

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);
const ghostAt = (text: string, today: Date) => suggest(parseDoc(text), text.length, DEFAULT_SETTINGS, today).ghost?.text ?? null;

describe('related', () => {
  it.each([
    ['Chin ups', 'Weighted chin ups', true],
    ['Weighted chin ups', 'Chin ups', true],
    ['Calf raises', 'Seated calf raises', true],
    ['Shrugs', 'Shrugs-barbell', true],
    ['Bench', 'Incline db', false],
    ['Leg curls', 'Leg extensions', false],
    ['Db lat raise', 'Incline db', false],
    ['Bench', 'bench', true],
  ])('%s / %s', (a, b, expected) => {
    expect(related(a, b)).toBe(expected);
  });
});

describe('suggestions skip related exercises', () => {
  it('synthetic', () => {
    const today = new Date(2026, 0, 5, 10);
    const base = '1/1\nPull\nChin ups-180-3/\nRows-300-8/\n\n1/5\nPull\nWeighted chin ups-190-3/\n';
    expect(ghostAt(base, today)).toBe('Rows');
    expect(ghostAt(base + 'Rows-300-8/\n', today)).toBeNull();
  });

  describe.skipIf(!existsSync(fixturePath))('fixture', () => {
    const F = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : '';
    const yesterday = new Date(2026, 10, 22, 10);

    it('skips the related exercise on an empty line', () => {
      expect(ghostAt(F + '\n', yesterday)).toBeNull();
      expect(ghostAt(F + '\n', new Date(2026, 10, 23, 1))).toBeNull();
    });

    it('skips related names while typing a prefix', () => {
      expect(ghostAt(F + '\nC', yesterday)).toBe('alf raise machine');
    });

    it('still gives weights for an exact name', () => {
      expect(ghostAt(F + '\nChin ups', yesterday)).toBe('-180');
    });
  });
});
