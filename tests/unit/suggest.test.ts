import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDoc } from '../../src/core/parse';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { rankDayTypes, suggest } from '../../src/core/suggest';
import type { Settings } from '../../src/core/types';

const TODAY = new Date(2026, 10, 23);

function ghostAt(text: string, settings: Settings = DEFAULT_SETTINGS, today = TODAY) {
  return suggest(parseDoc(text), text.length, settings, today).ghost;
}
const ghostText = (text: string, settings?: Settings) => ghostAt(text, settings)?.text ?? null;

function sessionsDoc(lines: string[], next: string): string {
  const entries = lines.map((l, i) => `1/${1 + i * 2}\nPush\n${l}\n`);
  return entries.join('\n') + `\n1/${1 + lines.length * 2}\nPush\n${next}`;
}

describe('weight progression', () => {
  it.each([
    [['Bench-300-4/', 'Bench-300-5/'], '-305'],
    [['Bench-300-4/', 'Bench-300-3/'], '-300'],
    [['Bench-295-4/', 'Bench-300-4/'], '-300'],
    [['X-max-8/', 'X-max-9/'], '-max'],
    [['Calf raises-410-10/', 'Calf raises-410-11/'], '-415'],
    [['Calf raises-410-10/', 'Calf raises-410-9/'], '-410'],
    [['Calf raises-410-5/', 'Calf raises-410-6/'], '-415'],
    [['X-84-6/', 'X-92.5-3/', 'X-91-5/', 'X-91-5/'], '-92.5'],
    [['Bench-300-4/', 'Bench-300-5/', 'Bench-3x5/'], '-305'],
  ])('%j', (sessions, expected) => {
    const name = sessions[0].split('-')[0];
    expect(ghostText(sessionsDoc(sessions, name))).toBe(expected);
  });

  it('honours settings overrides', () => {
    const sessions = ['Bench-300-4/', 'Bench-300-5/'];
    const inc: Settings = { ...DEFAULT_SETTINGS, exercises: { bench: { increment: 10 } } };
    const tgt: Settings = { ...DEFAULT_SETTINGS, exercises: { bench: { target: 6 } } };
    expect(ghostText(sessionsDoc(sessions, 'Bench'), inc)).toBe('-310');
    expect(ghostText(sessionsDoc(sessions, 'Bench'), tgt)).toBe('-300');
  });

  it('suggests later sets from the last session', () => {
    const s = ['Bench-300-3/280-5/260-8/'];
    expect(ghostText(sessionsDoc(s, 'Bench-300-3/'))).toBe('280');
    expect(ghostText(sessionsDoc(s, 'Bench-300-3/280-5/260-8/'))).toBeNull();
  });

  it('keeps the pair suffix', () => {
    const s = ['Curls-60s-4/55s-6/'];
    expect(ghostText(sessionsDoc(s, 'Curls'))).toBe('-60s');
    expect(ghostText(sessionsDoc(s, 'Curls-60s-4/'))).toBe('55s');
  });
});

describe('rankDayTypes', () => {
  const days = ['Push', 'Legs', 'Pull', 'Push', 'Legs', 'Pull', 'Push', 'Pull', 'Legs'];
  const doc = parseDoc(days.map((d, i) => `1/${i + 1}\n${d}\nBench-1-1/`).join('\n\n'));

  it('ranks by what followed the previous day type', () => {
    expect(rankDayTypes(doc, 9, 'push', '')[0]).toBe('legs');
    expect(rankDayTypes(doc, 9, 'push', 'p')[0]).toBe('pull');
  });

  it('falls back to recency', () => {
    expect(rankDayTypes(doc, 9, null, '')[0]).toBe('legs');
  });
});

const fixturePath = new URL('../fixtures/gym-2026.txt', import.meta.url);

describe.skipIf(!existsSync(fixturePath))('fixture suggestions', () => {
  const F = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf8') : '';
  const B = F + '\n\n11/23\nPush\n';
  const bench = '[{"date":"11/21","sets":"290-3/270-5/245-9"},{"date":"11/13","sets":"290-3/265-6"}]';
  const g = (text: string) => {
    const x = ghostAt(text);
    return x ? [x.text, x.kind, x.space] : null;
  };

  it.each([
    [F + '\n', ['Chin ups', 'name', false]],
    [F + '\n\n', ['11/23', 'date', false]],
    [F + '\n\n1', ['1/23', 'date', false]],
    [F + '\n\n11/23', null],
    [F + '\n\n11/23\n', null],
    [F + '\n\n11/23\nP', ['ush', 'day', false]],
    [F + '\n\n11/23\nPush', null],
    [B, ['Bench', 'name', false]],
    [B + 'B', ['ench', 'name', false]],
    [B + 'Inc', ['line db', 'name', false]],
    [B + 'T', ['ricep pushdowns', 'name', false]],
    [B + 'Bench', ['-290', 'weight', false]],
    [B + 'Bench-', ['290', 'weight', true]],
    [B + 'Bench-2', ['90', 'weight', true]],
    [B + 'Bench-290', ['-', 'dash', true]],
    [B + 'Bench-285', ['-', 'dash', true]],
    [B + 'Bench-290-', null],
    [B + 'Bench-290-4', ['/', 'slash', true]],
    [B + 'Bench-290-4/', ['270', 'weight', true]],
    [B + 'Bench-290-4/270-5/', ['245', 'weight', true]],
    [B + 'Bench-290-4/270-5/245-9/', null],
    [B + 'Bench-290-4/270-5/245-9/\n', ['Incline db', 'name', false]],
    [B + 'Bench-290-4/270-5/245-9/\nIncline db', ['-105', 'weight', false]],
    [B + 'Bench-290-4/270-5/245-9/\nIncline db-105-5/', null],
    [B + 'Bench-290-4/270-5/245-9/\nIncline db-105-5/\n', ['Db lat raise', 'name', false]],
    [B + 'Db lat raise', ['-40', 'weight', false]],
    [B + 'Db lat raise-40-9/', ['40', 'weight', true]],
    [B + 'Db lat raise-40-9/40-8/', null],
    [B + 'Tricep pushdowns', ['-max', 'weight', false]],
    [B + 'Tricep pushdowns-m', ['ax', 'weight', true]],
    [B + 'Tricep pushdowns-max-8/', ['max', 'weight', true]],
    [B + 'Tricep pushdowns-max-8/max-7/max-6/', null],
    [
      B +
        'Bench-290-4/270-5/245-9/\nIncline db-105-5/\nDb lat raise-40-9/40-8/\nTricep pushdowns-max-8/max-7/max-6/\n',
      null,
    ],
  ])('ghost for %#', (text, expected) => {
    expect(g(text)).toEqual(expected);
  });

  it('suggests an exercise when today already has an entry', () => {
    expect(ghostAt(F + '\n\n', DEFAULT_SETTINGS, new Date(2026, 10, 22))?.text).toBe('Chin ups');
  });

  it('ranks day types', () => {
    expect(rankDayTypes(parseDoc(F), 222, 'pull', 'p')[0]).toBe('push');
  });

  it('fills the strip', () => {
    for (const text of [B + 'Bench', B + 'Bench-290-4/']) {
      expect(JSON.stringify(suggest(parseDoc(text), text.length, DEFAULT_SETTINGS, TODAY).strip)).toBe(bench);
    }
    const text = B + 'Bench';
    const s = suggest(parseDoc(text), text.length - 1, DEFAULT_SETTINGS, TODAY);
    expect(s.ghost).toBeNull();
    expect(JSON.stringify(s.strip)).toBe(bench);
  });

  it('shows the strip at the end of the unmodified fixture', () => {
    const s = suggest(parseDoc(F), F.length, DEFAULT_SETTINGS, TODAY);
    expect(s.ghost).toBeNull();
    expect(s.strip).toEqual([
      { date: '11/18', sets: '75-5/70-5' },
      { date: '11/12', sets: '75-6/75-4/70-6' },
    ]);
  });
});
