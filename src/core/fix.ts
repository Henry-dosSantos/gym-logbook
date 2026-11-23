import { sessionsOf, spellingIndex } from './history';
import { DEFAULT_SETTINGS } from './settings';
import type { Doc, Entry, Line } from './types';

const VALID_SUFFIX = /^(s|sec|secs|second|seconds)$/i;

function backwardsMonth(doc: Doc, line: Line): number | null {
  let max: { ordinal: number; month: number; day: number } | null = null;
  for (const l of doc.lines) {
    if (l.n >= line.n) break;
    if (l.kind !== 'date') continue;
    const ordinal = l.month! * 31 + l.day!;
    if (!max || ordinal >= max.ordinal) max = { ordinal, month: l.month!, day: l.day! };
    else if (max.month - l.month! >= 6) max = { ordinal, month: l.month!, day: l.day! };
  }
  if (!max || line.day === undefined) return null;
  if (line.day >= max.day) return max.month;
  return max.month === 12 ? 1 : max.month + 1;
}

function entryOfLine(doc: Doc, line: Line): Entry | null {
  for (let i = doc.entries.length - 1; i >= 0; i--) {
    if (doc.entries[i].dateLine.n <= line.n) return doc.entries[i];
  }
  return null;
}

function guessName(doc: Doc, line: Line, aliases: string[][]): string | null {
  const first = line.sets?.[0]?.weight;
  const entry = entryOfLine(doc, line);
  if (typeof first !== 'number' || !entry) return null;
  const { latest } = spellingIndex(doc, entry.index, aliases);
  const candidates: { key: string; n: number; diff: number; last: number; sameDay: boolean }[] = [];
  for (const key of latest.keys()) {
    const sessions = sessionsOf(doc, key, entry.index, aliases, true);
    if (!sessions.length) continue;
    const last = sessions[sessions.length - 1];
    const h = last.sets[0].weight;
    if (typeof h !== 'number' || Math.abs(h - first) > 0.1 * first) continue;
    candidates.push({
      key,
      n: sessions.length,
      diff: Math.abs(h - first),
      last: last.entry.index,
      sameDay: entry.dayKey !== null && sessions.some(s => s.entry.dayKey === entry.dayKey),
    });
  }
  const pool = candidates.some(c => c.sameDay) ? candidates.filter(c => c.sameDay) : candidates;
  pool.sort((a, b) => b.n - a.n || a.diff - b.diff || b.last - a.last);
  return pool.length ? latest.get(pool[0].key)! : null;
}

export function suggestFix(doc: Doc, line: Line, aliases: string[][] = DEFAULT_SETTINGS.aliases): string | null {
  const code = doc.flags.find(f => f.line === line.n)?.code;
  const text = line.text;
  const indent = /^\s*/.exec(text)![0];
  const body = text.slice(indent.length);

  switch (code) {
    case 'date-backwards': {
      const month = backwardsMonth(doc, line);
      if (month === null) return null;
      return indent + body.replace(/^\d{1,2}(?=\/)/, String(month));
    }
    case 'wrong-year':
      return indent + body.replace(/^(\d{1,2}\/\d{1,2})\/\d{2,4}/, '$1');
    case 'bad-number': {
      const fixed = text.replace(/(?<![\d.a-z])(\d+(?:\.\d+)?)([a-z]+)(?=[-/(]|$)/gi, (m, num: string, letters: string) =>
        VALID_SUFFIX.test(letters) ? m : num,
      );
      return fixed === text ? null : fixed;
    }
    case 'missing-dash': {
      const name = line.name ?? '';
      const at = text.indexOf(name);
      const match = /^(.*?)(\d+)$/.exec(name);
      if (at < 0 || !match) return null;
      return `${text.slice(0, at)}${match[1]}-${match[2]}${text.slice(at + name.length)}`;
    }
    case 'bad-set': {
      const fixed = text.replace(
        /(?<![\d.])(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)(?![\d.])/,
        '$1x$2-$3',
      );
      return fixed === text ? null : fixed;
    }
    case 'no-name':
    case 'day-as-name': {
      const name = guessName(doc, line, aliases);
      if (!name) return null;
      const sets = code === 'no-name' ? body.replace(/^-/, '') : body.slice(body.indexOf('-') + 1);
      return `${indent}${name}-${sets}`;
    }
    default:
      return null;
  }
}

