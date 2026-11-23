import { describe, expect, it } from 'vitest';
import { normalizeDay, parseDoc } from '../../src/core/parse';
import type { Line } from '../../src/core/types';

const lastLine = (line: string): Line => {
  const doc = parseDoc('1/1\nPush\n' + line);
  return doc.lines[doc.lines.length - 1];
};
const pairs = (l: Line) => l.sets!.map(s => [s.weight, s.reps]);

describe('exercise lines', () => {
  it('parses plain sets', () => {
    const l = lastLine('Bench-310-2/285-5/275-5/');
    expect(l.kind).toBe('exercise');
    expect(l.name).toBe('Bench');
    expect(pairs(l)).toEqual([[310, 2], [285, 5], [275, 5]]);
    expect(l.setsText).toBe('310-2/285-5/275-5');
  });

  it('parses pair weights', () => {
    const l = lastLine('Seated Zottman curls-60s-4/55s-6/50s-7/');
    expect(l.sets!.map(s => s.weight)).toEqual([60, 55, 50]);
    expect(l.sets!.every(s => s.pair)).toBe(true);
    expect(l.sets!.map(s => s.reps)).toEqual([4, 6, 7]);
  });

  it('parses durations', () => {
    const l = lastLine('Weighted plank-45-60s/70-60s/');
    expect(l.sets!.map(s => s.weight)).toEqual([45, 70]);
    expect(l.sets!.map(s => s.seconds)).toEqual([60, 60]);
    expect(l.sets!.map(s => s.reps)).toEqual([null, null]);
    const w = lastLine('Static pull up hold-180-10 seconds/');
    expect(w.sets![0].weight).toBe(180);
    expect(w.sets![0].seconds).toBe(10);
  });

  it.each([
    ['Tricep pushdowns-3x6-8/', { sets: 3, repsMin: 6, repsMax: 8 }],
    ['Tricep pushdowns-2x20/', { sets: 2, repsMin: 20, repsMax: 20 }],
    ['Tricep pushdowns-3x5-8 on max', { sets: 3, repsMin: 5, repsMax: 8 }],
    ['Tricep pushdowns-7-8x3', { sets: 3, repsMin: 7, repsMax: 8 }],
    ['Tricep pushdowns-3x-10', { sets: 3, repsMin: null, repsMax: 10 }],
    ['Tricep pushdowns-3x12', { sets: 3, repsMin: 12, repsMax: 12 }],
    ['Tricep pushdowns-155x3', { sets: 155, repsMin: 3, repsMax: 3 }],
    ['Cable lat raises\u20143x5-8/', { sets: 3, repsMin: 5, repsMax: 8 }],
  ])('shorthand %s', (text, expected) => {
    const l = lastLine(text);
    expect(l.kind).toBe('exercise');
    expect(l.shorthand).toEqual(expected);
    expect(l.sets).toEqual([]);
  });

  it('keeps the raw text and ignores parentheticals', () => {
    const text = 'Neutral pull ups-195-3(internal bleeding under callous)/175-4/';
    const l = lastLine(text);
    expect(l.text).toBe(text);
    expect(pairs(l)).toEqual([[195, 3], [175, 4]]);
    expect(l.setsText).toBe('195-3/175-4');
  });

  it('handles odd set tokens', () => {
    expect(pairs(lastLine('Flat bench-285-3/275-4/315-0/'))[2]).toEqual([315, 0]);
    expect(pairs(lastLine('shrugs-360-12/360-10/360\u20139/'))[2]).toEqual([360, 9]);
    expect(pairs(lastLine('Pronated pull ups-180-3/160-3/135-5:'))).toEqual([[180, 3], [160, 3], [135, 5]]);
    expect(lastLine('Leg press-290-10/290-/290-/').sets!.map(s => s.reps)).toEqual([10, null, null]);
    const max = lastLine('Calf raises-max-/max-/max-/');
    expect(max.sets!.map(s => s.weight)).toEqual(['max', 'max', 'max']);
    expect(max.sets!.map(s => s.reps)).toEqual([null, null, null]);
    expect(lastLine('Bench-275-3.5/245-6/').sets![0].reps).toBe(3.5);
    const fail = lastLine('Leg extensions-230-9/230-10/230-fail + partials~12');
    expect(fail.sets![2].weight).toBe(230);
    expect(fail.sets![2].reps).toBeNull();
    expect(fail.flags).toEqual([]);
    expect(pairs(lastLine('Calf raises-402.5-10/402.5-10/402.5(slow)-6/'))[2]).toEqual([402.5, 6]);
    expect(lastLine('Tricep pushdowns-max-6//max-5/max-5/').sets).toHaveLength(3);
    const trailing = lastLine('Shrugs-max-14/max-12/max-12-');
    expect(trailing.sets).toHaveLength(3);
    expect(pairs(trailing)[2]).toEqual(['max', 12]);
    expect(trailing.flags).toEqual([]);
    const adjusted = lastLine('Single arm cable rows-max-7/max-6/(adjusted seat back)max-7/');
    expect(adjusted.sets!.map(s => s.weight)).toEqual(['max', 'max', 'max']);
  });

  it('finds the name separator', () => {
    const barbell = lastLine('Shrugs-barbell-315-7/315-5/');
    expect(barbell.name).toBe('Shrugs-barbell');
    expect(barbell.sets).toHaveLength(2);
    const paren = lastLine('Bench(slow)275-3/255-4/');
    expect(paren.name).toBe('Bench');
    expect(pairs(paren)).toEqual([[275, 3], [255, 4]]);
    expect(paren.flags).toEqual([]);
    expect(lastLine('Tricep pushdowns(straight bar)-170-6/180-6/190-5/').name).toBe('Tricep pushdowns');
    expect(lastLine('Flat bench -275-4/245-6/225-7/').name).toBe('Flat bench');
    const light = lastLine('Reverse ez bar curls-light-15/light-15/light-15/');
    expect(light.kind).toBe('exercise');
    expect(light.sets!.map(s => [s.weight, s.reps])).toEqual([[null, 15], [null, 15], [null, 15]]);
    const sit = lastLine('Super sit ups-10/10/9/');
    expect(sit.sets!.map(s => [s.weight, s.reps])).toEqual([[null, 10], [null, 10], [null, 9]]);
    const missing = lastLine('Calf raises465-14/465-14/465-12/');
    expect(missing.name).toBe('Calf raises465');
    expect(missing.flags).toEqual(['missing-dash']);
  });

  it.each([
    'Power push-doing biceps+shoulder tmw with Uncle',
    'Heavy pull-QUICK FOR MOVIE NIGHT',
    'Power push-feeling fatigued from 2 heavy exams today',
    'Heavy push - exam day, controlled session',
    'Burned about 400-450 kcal total from cycling and running on treadmill',
    'Pronated pull ups. Feeling better. Think I can do 180-4 next cycle.',
    'Heavy peloton-',
    'Db lat raises-',
    'Leg extensions',
    'BACK AT COLLEGE.',
    '# Forearms ached during curls.',
    '20 min walk',
    '8 mins',
    '3.5 mph at 6 degree incline',
    '6% incline',
    '180 degrees',
    '    55 resistance @ ~70 RPM',
  ])('treats %j as a note', text => {
    const doc = parseDoc('1/1\nPush\nBench-225-5/\n' + text);
    expect(doc.lines[3].kind).toBe('note');
  });

  it('flags bad numbers and sets', () => {
    expect(lastLine('Back extensions-270-6/270-5/250q-6/').flags).toEqual(['bad-number']);
    expect(lastLine('Back extensions-270-6q/').flags).toEqual(['bad-number']);
    expect(lastLine('Calf raises-3-10-13/').flags).toEqual(['bad-set']);
  });
});

describe('structure', () => {
  it('parses supersets', () => {
    const doc = parseDoc('1/1\nPush\nSuperset:\n    Tricep pushdowns-175-6/175-6/\n    Db lat raises-35-10/35-9/');
    expect(doc.lines.map(l => l.kind)).toEqual(['date', 'day', 'superset', 'exercise', 'exercise']);
    expect(doc.lines[3].name).toBe('Tricep pushdowns');
    expect(doc.lines[4].name).toBe('Db lat raises');
  });

  it('takes the day type from the date line', () => {
    const doc = parseDoc('8/12 push at 11 pm\nBench-295-5/275-6/');
    expect(doc.entries).toHaveLength(1);
    expect(doc.entries[0].dayKey).toBe('push at 11 pm');
    expect(doc.entries[0].dayLine).toBe(doc.lines[0]);
    expect(doc.lines[1].kind).toBe('exercise');
  });

  it('classifies dates', () => {
    const doc = parseDoc('Gym 2026\n1/1\n6/7 \n2/8/25\nPush\n10/10/9/\n40-5/40-5/');
    expect(doc.year).toBe(2026);
    expect(doc.lines.map(l => l.kind)).toEqual(['header', 'date', 'date', 'date', 'day', 'note', 'exercise']);
    expect(doc.lines[2].rest).toBe('');
    expect(doc.lines[3].year).toBe(25);
  });

  it.each([
    ['Heavy push - exam day, controlled session', 'Heavy push', 'heavy push'],
    ['Pull. Stressed out.', 'Pull', 'pull'],
    ['Power push-FAST', 'Power push', 'power push'],
    ['Home- misc', 'Home', 'home'],
    ['Legs!', 'Legs', 'legs'],
    ['Pull ', 'Pull', 'pull'],
    ['(Had exam today...)', null, null],
  ])('normalizes day %j', (text, raw, key) => {
    expect(normalizeDay(text)).toEqual({ raw, key });
  });

  it('picks the repeated day type as the day line', () => {
    const doc = parseDoc('1/1\nPull\nBench-1-1/\n\n1/2\nNote about stuff\nPull\nBench-1-1/\n\n1/3\nPull\nBench-1-1/');
    expect(doc.entries[1].dayLine!.n).toBe(7);
    expect(doc.lines[5].kind).toBe('note');
  });
});

describe('never throws', () => {
  const punctuation = Array.from({ length: 200 }, (_, i) => '-/()x:.,;_+~*&%$#@!?<>'[(i * 7) % 22]).join('');
  it.each(['', '\n\n\n', '-', '////', '((((', '1/1\n-\n/\n-5-', punctuation, '1/1\n' + punctuation])(
    'parses %#',
    text => {
      const doc = parseDoc(text);
      expect(doc.lines.map(l => l.text).join('\n')).toBe(text);
    },
  );
});

describe('continuations', () => {
  it('inherits the name of a note line', () => {
    const l = lastLine(
      'Bench-225-5/\nRDLs(grip is limiting factor for each)\n345-6/335-3(grip gave out)/315-5/',
    );
    expect(l.kind).toBe('exercise');
    expect(l.name).toBe('RDLs');
    expect(l.inherited).toBe(true);
    expect(l.sets).toHaveLength(3);
    expect(l.flags).toEqual([]);
  });

  it('inherits from a trailing dash name', () => {
    expect(lastLine('Db lat raises-\n40-8/35-8/35-8/').name).toBe('Db lat raises');
  });

  it('inherits from the previous exercise line', () => {
    const l = lastLine('Cable lat raises-40-11/(fast for next 2)\n40-5/40-5/');
    expect(l.name).toBe('Cable lat raises');
    expect(l.inherited).toBe(true);
  });

  it('flags a nameless line after a day line', () => {
    const doc = parseDoc('1/1\nChest recov at home\n250-8/250-6/225-8/');
    const l = doc.lines[2];
    expect(l.flags).toEqual(['no-name']);
    expect(l.name).toBe('');
  });
});

describe('lint', () => {
  it('flags backwards dates once', () => {
    const doc = parseDoc('1/5\nA\n\n1/3\nB\n\n1/6\nC');
    expect(doc.flags.map(f => [f.line, f.code])).toEqual([[4, 'date-backwards']]);
    expect(doc.flags[0].message).toBe('Date goes backwards');
  });

  it('treats a year rollover as in order', () => {
    expect(parseDoc('12/30\nA\n\n1/2\nB').flags).toEqual([]);
  });

  it('flags a year that differs from the header', () => {
    const doc = parseDoc('Gym 2026\n2/8/25\nPush');
    expect(doc.flags).toEqual([{ line: 2, code: 'wrong-year', message: 'Year differs from header' }]);
  });

  it('flags a day type used as an exercise name', () => {
    const doc = parseDoc('1/1\nLegs\nBench-1-1/\n\n1/2\nLegs\nBench-1-1/\n\n1/3\nPush\nLegs-100-5/');
    expect(doc.flags.map(f => [f.line, f.code])).toEqual([[11, 'day-as-name']]);
  });
});
