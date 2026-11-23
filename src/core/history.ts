import type { Doc, Entry, Line, SetEntry } from './types';

export interface Session { entry: Entry; sets: SetEntry[]; setsText: string }

export interface SpellingIndex {
  known: Set<string>;                 // normalized spellings seen in history
  latest: Map<string, string>;        // key -> most recent spelling as typed
  recent: string[];                   // keys, most recently used first
}

const LOCAL_BAD: ReadonlySet<string> = new Set(['no-name', 'day-as-name', 'missing-dash']);

export const normName = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');

export function exerciseKey(name: string, aliases: string[][]): string {
  const n = normName(name);
  for (const group of aliases) {
    if (group.some(member => normName(member) === n)) return normName(group[0]);
  }
  return n;
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
  return [...counts.keys()]
    .filter(k => counts.get(k)! >= 2 && k.startsWith(prefix))
    .sort((a, b) => (following.get(b) ?? 0) - (following.get(a) ?? 0) || lastIndex.get(b)! - lastIndex.get(a)!);
}
