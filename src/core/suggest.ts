import { findExercise, normalizeDashes } from './parse';
import {
  countingLines,
  countsForHistory,
  dayKeyCounts,
  exerciseKey,
  latestEntryWithDayKey,
  normName,
  rankDayTypes,
  sessionsOf,
  spellingIndex,
} from './history';
import type { Session } from './history';
import type { Doc, Entry, ExerciseSetting, Ghost, Line, SetEntry, Settings, StripItem, Suggestion } from './types';

export { rankDayTypes };

const DEFAULT_TARGET = 4;
const WEIGHT_TOKEN = /^\d+(\.\d+)?s?$/;
const WEIGHT_OR_MAX = /^(?:\d+(?:\.\d+)?s?|max)$/i;
const WEIGHT_AND_REPS = /^(?:\d+(?:\.\d+)?s?|max)-\d+(?:\.\d+)?s?$/i;

function formatWeight(set: SetEntry, weight: number | 'max'): string {
  return weight === 'max' ? 'max' : String(weight) + (set.pair ? 's' : '');
}

export function suggestWeight(
  sessions: Session[],
  setNumber: number,
  opts: ExerciseSetting,
  defaults: ExerciseSetting = {},
): string | null {
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  if (setNumber >= 2) {
    const set = last.sets[setNumber - 1];
    if (!set || set.weight === null) return null;
    return formatWeight(set, set.weight);
  }
  const first = last.sets[0];
  const w = first.weight;
  if (w === null) return null;
  if (w === 'max') return 'max';
  const prev = sessions[sessions.length - 2];
  const target = opts.target ?? defaults.target ?? DEFAULT_TARGET;
  const prevFirst = prev?.sets[0];
  const progressed =
    prevFirst !== undefined &&
    prevFirst.weight === w &&
    prevFirst.reps !== null &&
    first.reps !== null &&
    prevFirst.reps >= target &&
    first.reps >= target;
  if (!progressed) return formatWeight(first, w);
  const step = defaults.increment ?? 5;
  let next = w + step;
  if (opts.increment !== undefined) next = w + opts.increment;
  else if (w % 5 !== 0) {
    const higher = sessions
      .flatMap(s => s.sets)
      .map(s => s.weight)
      .filter((x): x is number => typeof x === 'number' && x > w && x <= w + 15);
    if (higher.length) next = Math.min(...higher);
  }
  return formatWeight(first, next);
}

export function exerciseList(
  doc: Doc,
  aliases: string[][],
): { key: string; name: string; sessions: number }[] {
  const { latest } = spellingIndex(doc, doc.entries.length, aliases);
  const out = [];
  for (const [key, name] of latest) {
    const sessions = sessionsOf(doc, key, doc.entries.length, aliases, true);
    if (sessions.length) out.push({ key, name, sessions: sessions.length });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

function weightFor(doc: Doc, cur: Entry, key: string, setNumber: number, settings: Settings): string | null {
  const sessions = sessionsOf(doc, key, cur.index, settings.aliases, true);
  return suggestWeight(sessions, setNumber, settings.exercises[key] ?? {}, settings.defaults);
}

function lastUsableSetCount(doc: Doc, cur: Entry, key: string, settings: Settings): number {
  const sessions = sessionsOf(doc, key, cur.index, settings.aliases, true);
  return sessions.length ? sessions[sessions.length - 1].sets.length : 0;
}

function lineAt(doc: Doc, pos: number): Line {
  const p = Math.max(0, Math.min(pos, doc.text.length));
  for (const l of doc.lines) if (p >= l.from && p <= l.to) return l;
  return doc.lines[doc.lines.length - 1];
}

function entryOf(doc: Doc, line: Line): Entry | null {
  for (let i = doc.entries.length - 1; i >= 0; i--) {
    if (doc.entries[i].dateLine.n <= line.n) return doc.entries[i];
  }
  return null;
}

interface NameSets { name: string; sets: string }

function splitNamed(doc: Doc, cur: Entry, line: Line, settings: Settings): NameSets | null {
  const tp = normalizeDashes(line.text).replace(/\([^)]*\)/g, '');
  const shape = findExercise(normalizeDashes(line.text));
  if (shape && shape.name !== null) {
    return { name: shape.name, sets: shape.sets };
  }
  const { known } = spellingIndex(doc, cur.index, settings.aliases);
  for (let i = 1; i < tp.length; i++) {
    if (tp[i] !== '-') continue;
    const name = tp.slice(0, i).trim();
    if (name && known.has(normName(name))) return { name, sets: tp.slice(i + 1) };
  }
  return null;
}

function numericGhost(doc: Doc, cur: Entry, line: Line, settings: Settings): Ghost | null {
  const named = splitNamed(doc, cur, line, settings);
  if (!named) return null;
  const sp = named.sets.replace(/^\s*-/, '');
  if (/\dx/i.test(sp)) return null;
  const key = exerciseKey(named.name, settings.aliases);
  const slash = sp.lastIndexOf('/');
  const done = slash >= 0 ? sp.slice(0, slash).split('/').filter(s => s.trim()).length : 0;
  const c = (slash >= 0 ? sp.slice(slash + 1) : sp).trimStart();
  const w = weightFor(doc, cur, key, done + 1, settings);
  const weightGhost = (text: string): Ghost => ({ text, kind: 'weight', space: true });

  if (c === '') {
    if (w === null) return null;
    if (done >= 1 && done >= lastUsableSetCount(doc, cur, key, settings)) return null;
    return weightGhost(w);
  }
  if (WEIGHT_TOKEN.test(c) || (/^[a-z]+$/i.test(c) && 'max'.startsWith(c.toLowerCase()))) {
    if (w !== null && w.length > c.length && w.toLowerCase().startsWith(c.toLowerCase())) {
      return weightGhost(w.slice(c.length));
    }
    if (WEIGHT_OR_MAX.test(c)) return { text: '-', kind: 'dash', space: true };
    return null;
  }
  if (WEIGHT_AND_REPS.test(c)) {
    return { text: '/', kind: 'slash', space: true };
  }
  return null;
}

function stripFor(doc: Doc, cur: Entry | null, line: Line, settings: Settings): StripItem[] {
  const index = cur ? cur.index : doc.entries.length;
  let key: string | null = null;
  if (countsForHistory(line)) {
    key = exerciseKey(line.name!, settings.aliases);
  } else {
    const name = normalizeDashes(line.text).trim().replace(/-$/, '').trim();
    if (name && spellingIndex(doc, index, settings.aliases).known.has(normName(name))) {
      key = exerciseKey(name, settings.aliases);
    }
  }
  if (!key) return [];
  return sessionsOf(doc, key, index, settings.aliases, false)
    .slice(-2)
    .reverse()
    .map(s => ({ date: `${s.entry.month}/${s.entry.day}`, sets: s.setsText }));
}

function dateGhost(doc: Doc, line: Line, today: Date): Ghost | null {
  const t = line.text;
  const md = `${today.getMonth() + 1}/${today.getDate()}`;
  const typed = t.trim();
  if (line.n !== doc.lines.length || /^\s/.test(t) || typed.length >= md.length || !md.startsWith(typed)) return null;
  const prev = line.n > 1 ? doc.lines[line.n - 2] : null;
  if (prev && prev.kind !== 'blank' && doc.entries.length) return null;
  const last = doc.entries[doc.entries.length - 1];
  if (last && last.month === today.getMonth() + 1 && last.day === today.getDate()) return null;
  return { text: md.slice(typed.length), kind: 'date', space: false };
}

type DayResult = { ghost: Ghost | null } | null;

function dayGhost(doc: Doc, cur: Entry, line: Line): DayResult {
  const t = line.text;
  if (cur.dateLine.rest !== '' || line.n !== cur.dateLine.n + 1 || !t.trim() || line.kind === 'exercise') return null;
  const p = t.replace(/^\s+/, '').toLowerCase();
  if (dayKeyCounts(doc, cur.index).has(p)) return { ghost: null };
  const prevKey = cur.index > 0 ? doc.entries[cur.index - 1].dayKey : null;
  const best = rankDayTypes(doc, cur.index, prevKey, p)[0];
  if (best === undefined) return null;
  const entry = latestEntryWithDayKey(doc, cur.index, best);
  const display = entry?.dayRaw ?? '';
  const typedLen = t.replace(/^\s+/, '').length;
  if (display.length > typedLen && display.toLowerCase().startsWith(p)) {
    return { ghost: { text: display.slice(typedLen), kind: 'day', space: false } };
  }
  return { ghost: null };
}

function isActive(entry: Entry, today: Date): boolean {
  if (entry.month === today.getMonth() + 1 && entry.day === today.getDate()) return true;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return today.getHours() < 4 && entry.month === yesterday.getMonth() + 1 && entry.day === yesterday.getDate();
}

function emptyLineGhost(doc: Doc, cur: Entry, line: Line, settings: Settings, today: Date): Ghost | null {
  if (cur.index !== doc.entries.length - 1 || line.text !== '' || line.n === cur.dateLine.n) return null;
  if (!isActive(cur, today)) return null;
  if (doc.lines[line.n - 2].kind === 'blank') return null;
  if (cur.dateLine.rest === '' && line.n === cur.dateLine.n + 1) return null;
  if (cur.dayKey === null) return null;
  let ref: Entry | null = null;
  for (let i = cur.index - 1; i >= 0; i--) {
    const e = doc.entries[i];
    if (e.dayKey === cur.dayKey && countingLines(e).length) {
      ref = e;
      break;
    }
  }
  if (!ref) return null;
  const present = new Set(
    cur.lines.filter(l => l !== line && countsForHistory(l)).map(l => exerciseKey(l.name!, settings.aliases)),
  );
  const { latest } = spellingIndex(doc, cur.index, settings.aliases);
  for (const l of countingLines(ref)) {
    const key = exerciseKey(l.name!, settings.aliases);
    if (!present.has(key)) return { text: latest.get(key) ?? l.name!, kind: 'name', space: false };
  }
  return null;
}

function nameGhost(doc: Doc, cur: Entry, line: Line, settings: Settings): Ghost | null {
  const t = line.text;
  if (!t.trim() || normalizeDashes(t).includes('-') || line.kind === 'date') return null;
  const q = t.replace(/^\s+/, '');
  const { known, latest, recent } = spellingIndex(doc, cur.index, settings.aliases);
  if (known.has(normName(q))) {
    const key = exerciseKey(q, settings.aliases);
    const w = weightFor(doc, cur, key, 1, settings);
    return { text: w === null ? '-' : `-${w}`, kind: 'weight', space: false };
  }
  const lower = q.toLowerCase();
  const candidates = recent.filter(k => {
    const s = latest.get(k)!;
    return s.length > q.length && s.toLowerCase().startsWith(lower);
  });
  if (!candidates.length) return null;
  const sameDay = new Set<string>();
  if (cur.dayKey !== null) {
    for (const e of doc.entries) {
      if (e.index >= cur.index) break;
      if (e.dayKey !== cur.dayKey) continue;
      for (const l of countingLines(e)) sameDay.add(exerciseKey(l.name!, settings.aliases));
    }
  }
  const pick = candidates.find(k => sameDay.has(k)) ?? candidates[0];
  return { text: latest.get(pick)!.slice(q.length), kind: 'name', space: false };
}

export function suggest(doc: Doc, pos: number, settings: Settings, today: Date): Suggestion {
  const line = lineAt(doc, pos);
  const cur = entryOf(doc, line);
  const strip = stripFor(doc, cur, line, settings);
  if (pos !== line.to) return { ghost: null, strip };

  const date = dateGhost(doc, line, today);
  if (date) return { ghost: date, strip };
  if (!cur) return { ghost: null, strip };

  const day = dayGhost(doc, cur, line);
  if (day) return { ghost: day.ghost, strip };

  const empty = emptyLineGhost(doc, cur, line, settings, today);
  if (empty) return { ghost: empty, strip };

  const name = nameGhost(doc, cur, line, settings);
  if (name) return { ghost: name, strip };

  return { ghost: numericGhost(doc, cur, line, settings), strip };
}
