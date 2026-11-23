import { sessionsOf } from './history';
import { estimate1RM } from './onerm';
import { exerciseList } from './suggest';
import type { Doc } from './types';

export type Metric = 'weight' | 'reps';
export type Mode = 'sets' | '1rm';

export interface SeriesPoint {
  date: string;
  weight: number | null;
  max: boolean;
  reps: number | null;
  setsText: string;
  oneRm: number | null;
  oneRmFrom: { weight: number; reps: number } | null;
}

export interface DashboardItem {
  key: string;
  name: string;
  sessions: number;
  latestText: string;
  spark: (number | null)[];
  oneRmLatest: number | null;
  oneRmSpark: (number | null)[];
}

export function exerciseSeries(doc: Doc, key: string, aliases: string[][]): SeriesPoint[] {
  return sessionsOf(doc, key, doc.entries.length, aliases, true).map(s => {
    const first = s.sets[0];
    let oneRm: number | null = null;
    let oneRmFrom: { weight: number; reps: number } | null = null;
    for (const set of s.sets) {
      if (typeof set.weight !== 'number' || set.reps === null) continue;
      const estimate = estimate1RM(set.weight, set.reps);
      if (estimate !== null && (oneRm === null || estimate > oneRm)) {
        oneRm = estimate;
        oneRmFrom = { weight: set.weight, reps: set.reps };
      }
    }
    return {
      date: `${s.entry.month}/${s.entry.day}`,
      weight: typeof first.weight === 'number' ? first.weight : null,
      max: first.weight === 'max',
      reps: first.reps,
      setsText: s.setsText,
      oneRm,
      oneRmFrom,
    };
  });
}

export function metricPoints(series: SeriesPoint[], metric: Metric): SeriesPoint[] {
  return series.filter(p => (metric === 'weight' ? p.weight : p.reps) !== null);
}

export function setText(p: SeriesPoint): string {
  const w = p.weight !== null ? String(p.weight) : p.max ? 'max' : '';
  const r = p.reps !== null ? `× ${p.reps}` : '';
  return [w, r].filter(Boolean).join(' ');
}

export function dashboardItems(doc: Doc, aliases: string[][]): DashboardItem[] {
  const items: DashboardItem[] = [];
  for (const { key, name, sessions } of exerciseList(doc, aliases)) {
    if (sessions < 2) continue;
    const series = exerciseSeries(doc, key, aliases);
    const withWeight = series.filter(p => p.weight !== null).length;
    const useWeight = withWeight >= 2 && withWeight * 2 >= series.length;
    const oneRmSpark = series.map(p => p.oneRm);
    const lastOneRm = [...oneRmSpark].reverse().find(v => v !== null) ?? null;
    items.push({
      key,
      name,
      sessions,
      latestText: setText(series[series.length - 1]),
      spark: series.map(p => (useWeight ? p.weight : p.reps)),
      oneRmLatest: lastOneRm,
      oneRmSpark,
    });
  }
  return items;
}
