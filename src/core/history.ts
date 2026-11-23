import type { Doc, Entry, Line, SetEntry } from './types';

export interface Session { entry: Entry; sets: SetEntry[]; setsText: string }

export interface SpellingIndex {
  known: Set<string>;                 // normalized spellings seen in history
  latest: Map<string, string>;        // key -> most recent spelling as typed
  recent: string[];                   // keys, most recently used first
}

const LOCAL_BAD: ReadonlySet<string> = new Set(['no-name', 'day-as-name', 'missing-dash']);

export const normName = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');

const keyCaches = new WeakMap<string[][], { members: Map<string, string>; names: Map<string, string> }>();

export function exerciseKey(name: string, aliases: string[][]): string {
  let cache = keyCaches.get(aliases);
  if (!cache) {
    const members = new Map<string, string>();
    for (const group of aliases) {
      for (const member of group) {
        const m = normName(member);
        if (!members.has(m)) members.set(m, normName(group[0]));
      }
    }
    cache = { members, names: new Map() };
    keyCaches.set(aliases, cache);
  }
  let key = cache.names.get(name);
  if (key === undefined) {
    const n = normName(name);
    key = cache.members.get(n) ?? n;
    cache.names.set(name, key);
  }
  return key;
}

export function countsForHistory(line: Line): boolean {
  return line.kind === 'exercise' && !!line.name && !line.flags.some(f => LOCAL_BAD.has(f));
}

export function isUsable(line: Line): boolean {
  return countsForHistory(line) && !line.shorthand && line.flags.length === 0;
}

export function countingLines(entry: Entry): Line[] {
  return entry.lines.filter(countsForHistory);
}

export function sessionsOf(
  doc: Doc,
  key: string,
  beforeEntry: number,
  aliases: string[][],
  usableOnly: boolean,
): Session[] {
  const out: Session[] = [];
  for (const entry of doc.entries) {
    if (entry.index >= beforeEntry) break;
    const lines = entry.lines.filter(
      l => countsForHistory(l) && exerciseKey(l.name!, aliases) === key && (!usableOnly || isUsable(l)),
    );
    if (!lines.length) continue;
    const sets = lines.flatMap(l => l.sets ?? []);
    if (usableOnly && !sets.length) continue;
    out.push({ entry, sets, setsText: lines.map(l => l.setsText ?? '').join('/') });
  }
  return out;
}

export function spellingIndex(doc: Doc, beforeEntry: number, aliases: string[][]): SpellingIndex {
  const known = new Set<string>();
  const latest = new Map<string, string>();
  for (const entry of doc.entries) {
    if (entry.index >= beforeEntry) break;
    for (const l of countingLines(entry)) {
      const key = exerciseKey(l.name!, aliases);
      known.add(normName(l.name!));
      latest.delete(key);
      latest.set(key, l.name!);
    }
  }
  return { known, latest, recent: [...latest.keys()].reverse() };
}

export function dayKeyCounts(doc: Doc, beforeEntry: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of doc.entries) {
    if (e.index >= beforeEntry) break;
    if (e.dayKey) counts.set(e.dayKey, (counts.get(e.dayKey) ?? 0) + 1);
  }
  return counts;
}

export function latestEntryWithDayKey(doc: Doc, beforeEntry: number, dayKey: string): Entry | null {
  for (let i = Math.min(beforeEntry, doc.entries.length) - 1; i >= 0; i--) {
    if (doc.entries[i].dayKey === dayKey) return doc.entries[i];
  }
  return null;
}

export function rankDayTypes(doc: Doc, beforeEntry: number, prevKey: string | null, prefix: string): string[] {
  const counts = dayKeyCounts(doc, beforeEntry);
  const following = new Map<string, number>();
  const lastIndex = new Map<string, number>();
  for (const e of doc.entries) {
    if (e.index >= beforeEntry) break;
    if (e.dayKey) lastIndex.set(e.dayKey, e.index);
    const prev = e.index > 0 ? doc.entries[e.index - 1] : null;
    if (prevKey !== null && prev && prev.dayKey === prevKey && e.dayKey) {
      following.set(e.dayKey, (following.get(e.dayKey) ?? 0) + 1);
    }
  }
  const ranked = [...counts.keys()]
    .filter(k => counts.get(k)! >= 2 && k.startsWith(prefix))
    .sort((a, b) => (following.get(b) ?? 0) - (following.get(a) ?? 0) || lastIndex.get(b)! - lastIndex.get(a)!);
  const next = nextInRotation(doc, beforeEntry, prefix);
  return next === null ? ranked : [next, ...ranked.filter(k => k !== next)];
}

const TRIO = ['push', 'pull', 'legs'];
const LEADING_TRIO = /^\s*(push|pull|legs)\b/i;

/** Which of push, pull and legs an entry was: from its day type, else from a line that starts with one. */
export function trioOf(entry: Entry): string | null {
  const fromDay = entry.dayKey?.split(/[^a-z]+/).find(w => TRIO.includes(w));
  if (fromDay) return fromDay;
  for (const line of entry.lines.slice(1)) {
    const m = LEADING_TRIO.exec(line.text);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/**
 * Of push, pull and legs, the one done longest ago, assumed to be today's.
 * Only types that appear in the log count; prefix narrows the choice.
 */
export function nextInRotation(doc: Doc, beforeEntry: number, prefix: string): string | null {
  const last = new Map<string, number>();
  for (let i = 0; i < Math.min(beforeEntry, doc.entries.length); i++) {
    const t = trioOf(doc.entries[i]);
    if (t) last.set(t, i);
  }
  let pick: string | null = null;
  for (const t of TRIO) {
    if (!last.has(t) || !t.startsWith(prefix)) continue;
    if (pick === null || last.get(t)! < last.get(pick)!) pick = t;
  }
  return pick;
}

export function todayText(doc: Doc, today: Date): string | null {
  if (!doc.entries.length) return null;
  const month = today.getMonth() + 1;
  const day = today.getDate();
  let entry = doc.entries[doc.entries.length - 1];
  for (let i = doc.entries.length - 1; i >= 0; i--) {
    if (doc.entries[i].month === month && doc.entries[i].day === day) {
      entry = doc.entries[i];
      break;
    }
  }
  const last = [...entry.lines].reverse().find(l => l.kind !== 'blank')!;
  return doc.text.slice(entry.dateLine.from, last.to);
}

const tokens = (s: string): string[] => normName(s).split(/[^a-z0-9.]+/).filter(Boolean);

function contains(outer: string[], inner: string[]): boolean {
  if (!inner.length || inner.length > outer.length) return false;
  for (let i = 0; i + inner.length <= outer.length; i++) {
    if (inner.every((t, j) => outer[i + j] === t)) return true;
  }
  return false;
}

export function related(a: string, b: string): boolean {
  const x = tokens(a);
  const y = tokens(b);
  return contains(x, y) || contains(y, x);
}
