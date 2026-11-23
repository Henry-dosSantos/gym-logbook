import type { Doc, Entry, LintCode, LintFlag, Line, SetEntry, Shorthand } from './types';

const MESSAGES: Record<LintCode, string> = {
  'date-backwards': 'Date goes backwards',
  'wrong-year': 'Year differs from header',
  'no-name': 'No exercise name',
  'day-as-name': 'Day type used as exercise name',
  'bad-number': 'Bad number',
  'missing-dash': 'Missing dash',
  'bad-set': 'Too many values in a set',
};

const DATE_RE = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(.*))?$/;
const SUPERSET_RE = /^\s*superset\b.*:\s*$/i;
const MARK = '\u0001';
const NAMELESS_RE = /^-?\s*(?:\d+(?:\.\d+)?[a-z]*|max)\s*-/i;
const SET_START_RE = /^\s*(?:\d+(?:\.\d+)?[a-z]*|max|light)\s*(?:-|x|\/|$)/i;

export const normalizeDashes = (s: string): string => s.replace(/[\u2013\u2014]/g, '-');

function parseDate(norm: string): { month: number; day: number; year?: number; rest: string } | null {
  const m = DATE_RE.exec(norm.trimEnd());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day, year: m[3] === undefined ? undefined : Number(m[3]), rest: (m[4] ?? '').trim() };
}

export function normalizeDay(text: string): { raw: string | null; key: string | null } {
  const norm = normalizeDashes(text);
  let cut = norm.length;
  for (const sep of ['-', '. ', '(', ',']) {
    const i = norm.indexOf(sep);
    if (i >= 0 && i < cut) cut = i;
  }
  const raw = norm.slice(0, cut).trim().replace(/[.!]+$/, '').trim();
  if (!raw) return { raw: null, key: null };
  return { raw, key: raw.toLowerCase().replace(/\s+/g, ' ') };
}

interface ExerciseShape { name: string | null; sets: string }

export function findExercise(norm: string): ExerciseShape | null {
  let p = norm.trimEnd().replace(/\([^)]*\)/g, MARK);
  if (p.endsWith(':')) p = p.slice(0, -1) + '/';
  const stripped = p.split(MARK).join('').trim();
  if (NAMELESS_RE.test(stripped)) return { name: null, sets: stripped.replace(/^-/, '') };
  for (let i = 1; i < p.length; i++) {
    if (p[i] !== '-' && p[i] !== MARK) continue;
    const name = p.slice(0, i).split(MARK).join('').trim();
    if (!name) continue;
    const after = p.slice(i + 1);
    if (SET_START_RE.test(after)) return { name, sets: after.split(MARK).join('') };
  }
  return null;
}

const emptySet = (): SetEntry => ({ weight: null, pair: false, reps: null, seconds: null });

function parseSets(sets: string): {
  sets: SetEntry[];
  shorthand: Shorthand | null;
  setsText: string;
  flags: LintCode[];
} {
  const flags: LintCode[] = [];
  let s = sets.trim();
  if (s.startsWith('-')) s = s.slice(1).trim();
  const segments = s.split('/').map(x => x.trim()).filter(Boolean);
  const setsText = segments.join('/');

  const body = s.replace(/\/$/, '');
  const m1 = /^(\d+)\s*x\s*(\d+)?(?:\s*-\s*(\d+))?/i.exec(body);
  const m2 = /^(\d+)(?:-(\d+))?\s*x\s*(\d+)\s*$/i.exec(body);
  let shorthand: Shorthand | null = null;
  if (m1) {
    shorthand = {
      sets: Number(m1[1]),
      repsMin: m1[2] === undefined ? null : Number(m1[2]),
      repsMax: m1[3] !== undefined ? Number(m1[3]) : m1[2] === undefined ? null : Number(m1[2]),
    };
  } else if (m2) {
    shorthand = {
      sets: Number(m2[3]),
      repsMin: Number(m2[1]),
      repsMax: m2[2] === undefined ? Number(m2[1]) : Number(m2[2]),
    };
  }
  if (shorthand) return { sets: [], shorthand, setsText, flags };

  const out: SetEntry[] = [];
  for (const seg of segments) {
    let parts = seg.split('-').map(x => x.trim());
    if (parts.length > 2 && parts[parts.length - 1] === '') parts = parts.slice(0, -1);
    if (parts.length > 2) flags.push('bad-set');
    const set = emptySet();
    const repsToken = parts.length === 1 ? parts[0] : parts[1];
    if (parts.length >= 2) {
      const w = parts[0];
      if (/^\d+(\.\d+)?$/.test(w)) set.weight = Number(w);
      else if (/^\d+(\.\d+)?s$/.test(w)) {
        set.weight = Number(w.slice(0, -1));
        set.pair = true;
      } else if (/^max$/i.test(w)) set.weight = 'max';
      else if (/^\d/.test(w)) flags.push('bad-number');
    }
    if (/^\d+(\.\d+)?$/.test(repsToken)) set.reps = Number(repsToken);
    else {
      const sec = /^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)$/i.exec(repsToken);
      if (sec) set.seconds = Number(sec[1]);
      else if (/^\d/.test(repsToken)) flags.push('bad-number');
    }
    out.push(set);
  }
  return { sets: out, shorthand: null, setsText, flags };
}

function nameFromNote(text: string): string {
  const stripped = normalizeDashes(text).replace(/\([^)]*\)/g, '').trim();
  const dot = stripped.indexOf('. ');
  return (dot >= 0 ? stripped.slice(0, dot) : stripped).replace(/[-\s]+$/, '').trim();
}

export function parseDoc(text: string): Doc {
  const lines: Line[] = [];
  const norms: string[] = [];
  let from = 0;
  text.split('\n').forEach((raw, i) => {
    lines.push({ n: i + 1, from, to: from + raw.length, text: raw, kind: 'note', flags: [] });
    norms.push(normalizeDashes(raw));
    from += raw.length + 1;
  });

  let year: number | null = null;
  const shapes = new Map<number, ExerciseShape>();
  lines.forEach((line, i) => {
    const norm = norms[i];
    if (!norm.trim()) {
      line.kind = 'blank';
      return;
    }
    const date = parseDate(norm);
    if (i === 0 && !date) {
      const y = /\b(20\d\d)\b/.exec(norm);
      if (y) {
        line.kind = 'header';
        year = Number(y[1]);
        return;
      }
    }
    if (date) {
      line.kind = 'date';
      line.month = date.month;
      line.day = date.day;
      line.year = date.year;
      line.rest = date.rest;
      return;
    }
    if (SUPERSET_RE.test(norm)) {
      line.kind = 'superset';
      return;
    }
    const shape = findExercise(norm);
    if (shape) {
      line.kind = 'exercise';
      shapes.set(i, shape);
    }
  });

  const entries: Entry[] = [];
  lines.forEach((line, i) => {
    if (line.kind !== 'date') return;
    const entry: Entry = {
      index: entries.length,
      dateLine: line,
      month: line.month!,
      day: line.day!,
      dayLine: null,
      dayRaw: null,
      dayKey: null,
      lines: [line],
    };
    for (let j = i + 1; j < lines.length && lines[j].kind !== 'date'; j++) entry.lines.push(lines[j]);
    entries.push(entry);
  });

  const candidatesOf = (entry: Entry): Line[] => {
    const out: Line[] = [];
    for (const l of entry.lines.slice(1)) {
      if (l.kind === 'exercise' || l.kind === 'superset') break;
      if (l.kind === 'note' && out.length < 3) out.push(l);
    }
    return out;
  };
  const provisional = entries.map(e => {
    if (e.dateLine.rest) return normalizeDay(e.dateLine.rest).key;
    const first = candidatesOf(e).find(l => l.n === e.dateLine.n + 1);
    return first ? normalizeDay(first.text).key : null;
  });
  const counts = new Map<string, number>();
  for (const k of provisional) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);

  for (const e of entries) {
    let dayLine: Line | null = null;
    let dayText = '';
    if (e.dateLine.rest) {
      dayLine = e.dateLine;
      dayText = e.dateLine.rest;
    } else {
      const cands = candidatesOf(e);
      const first = cands.find(l => l.n === e.dateLine.n + 1) ?? null;
      const keyOf = (l: Line) => normalizeDay(l.text).key;
      const firstKey = first ? keyOf(first) : null;
      if (first && firstKey && (counts.get(firstKey) ?? 0) >= 2) dayLine = first;
      else {
        dayLine = cands.find(l => {
          const k = keyOf(l);
          return k !== null && (counts.get(k) ?? 0) >= 2;
        }) ?? null;
        if (!dayLine && first && firstKey) dayLine = first;
      }
      if (dayLine) {
        dayLine.kind = 'day';
        dayText = dayLine.text;
      }
    }
    e.dayLine = dayLine;
    if (dayLine) {
      const d = normalizeDay(dayText);
      e.dayRaw = d.raw;
      e.dayKey = d.key;
    }
  }

  lines.forEach((line, i) => {
    const shape = shapes.get(i);
    if (!shape || line.kind !== 'exercise') return;
    const parsed = parseSets(shape.sets);
    line.sets = parsed.sets;
    line.shorthand = parsed.shorthand;
    line.setsText = parsed.setsText;
    for (const f of parsed.flags) if (!line.flags.includes(f)) line.flags.push(f);
    if (shape.name !== null) {
      line.name = shape.name;
      return;
    }
    const prev = i > 0 ? lines[i - 1] : null;
    let name = '';
    if (prev && prev.kind === 'exercise' && prev.name) name = prev.name;
    else if (prev && prev.kind === 'note') name = nameFromNote(prev.text);
    line.name = name;
    if (name) line.inherited = true;
    else line.flags.push('no-name');
  });

  const dayCounts = new Map<string, number>();
  for (const e of entries) if (e.dayKey) dayCounts.set(e.dayKey, (dayCounts.get(e.dayKey) ?? 0) + 1);
  for (const l of lines) {
    if (l.kind !== 'exercise' || l.inherited || !l.name) continue;
    const key = l.name.toLowerCase().replace(/\s+/g, ' ');
    if ((dayCounts.get(key) ?? 0) >= 2) l.flags.push('day-as-name');
    if (/\d$/.test(l.name)) l.flags.push('missing-dash');
  }

  let max: { ordinal: number; month: number } | null = null;
  for (const l of lines) {
    if (l.kind !== 'date') continue;
    const ordinal = l.month! * 31 + l.day!;
    if (!max || ordinal >= max.ordinal) max = { ordinal, month: l.month! };
    else if (max.month - l.month! >= 6) max = { ordinal, month: l.month! };
    else l.flags.push('date-backwards');
    if (l.year !== undefined && year !== null && l.year % 100 !== year % 100) l.flags.push('wrong-year');
  }

  const flags: LintFlag[] = [];
  for (const l of lines) {
    for (const code of l.flags) flags.push({ line: l.n, code, message: MESSAGES[code] });
  }
  flags.sort((a, b) => a.line - b.line || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  return { text, lines, entries, year, flags };
}

