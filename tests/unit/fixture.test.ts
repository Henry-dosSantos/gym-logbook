import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDoc } from '../../src/core/parse';
import type { LintCode } from '../../src/core/types';

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);

describe.skipIf(!existsSync(fixturePath))('fixture', () => {
  const text = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : '';
  const doc = parseDoc(text);
  const line = (n: number) => doc.lines[n - 1];
  const entryAt = (n: number) => doc.entries.find(e => e.dateLine.n === n)!;

  it('round-trips', () => {
    expect(doc.lines).toHaveLength(1447);
    expect(doc.text).toBe(text);
    expect(doc.lines.map(l => l.text).join('\n')).toBe(text);
  });

  it('finds every entry', () => {
    const dateLines = text.split('\n').filter(l => /^\d{1,2}\/\d{1,2}(\/\d{2,4})?(\s.*)?$/.test(l));
    expect(doc.entries).toHaveLength(222);
    expect(doc.entries).toHaveLength(dateLines.length);
    expect(doc.year).toBe(2026);
  });

  const required: [LintCode, number[]][] = [
    ['date-backwards', [424, 431, 438, 445, 452, 459, 466, 474, 1096, 1104]],
    ['wrong-year', [192, 253]],
    ['no-name', [194, 1372]],
    ['day-as-name', [1424]],
    ['bad-number', [100]],
    ['missing-dash', [823]],
    ['bad-set', [900]],
  ];
  it.each(required.flatMap(([code, lines]) => lines.map(n => [code, n] as const)))('flags %s on line %i', (code, n) => {
    expect(doc.flags.some(f => f.line === n && f.code === code)).toBe(true);
  });

  it.each([
    [197, 'Cable lat raises'],
    [310, 'Ez bar reverse curls'],
    [1021, 'Db lat raises'],
    [1099, 'RDLs'],
    [1237, 'Seated calf raise machine'],
    [1257, 'Pronated pull ups'],
  ])('line %i continues %s', (n, name) => {
    expect(line(n).kind).toBe('exercise');
    expect(line(n).inherited).toBe(true);
    expect(line(n).flags).toEqual([]);
    expect(line(n).name).toBe(name);
  });

  it('finds day lines', () => {
    expect(entryAt(1403).dayLine!.n).toBe(1405);
    expect(entryAt(1403).dayKey).toBe('pull');
    expect(line(1404).kind).toBe('note');
    expect(entryAt(1328).dayLine!.n).toBe(1330);
    expect(entryAt(1328).dayKey).toBe('legs');
    expect(entryAt(812).dayKey).toBe('pull');
    expect(entryAt(539).dayKey).toBe('heavy pull');
    expect(entryAt(1016).dayKey).toBe('push at 11 pm');
    expect(entryAt(105).dayLine).toBeNull();
  });

  it('has no flags beyond the required ones', () => {
    expect(doc.flags).toHaveLength(18);
    expect(line(687).kind).toBe('day');
  });

  it.each([366, 616, 617, 688, 689])('line %i is a note', n => {
    expect(line(n).kind).toBe('note');
  });
});
