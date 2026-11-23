import { sessionsOf } from './history';
import { exerciseList } from './suggest';
import type { Doc } from './types';

export type Metric = 'weight' | 'reps';

export interface SeriesPoint {
  date: string;
  weight: number | null;
  max: boolean;
  reps: number | null;
  setsText: string;
}

export interface DashboardItem {
  key: string;
  name: string;
  sessions: number;
  metric: Metric;
  values: number[];
  latest: number;
}

export function exerciseSeries(doc: Doc, key: string, aliases: string[][]): SeriesPoint[] {
  return sessionsOf(doc, key, doc.entries.length, aliases, true).map(s => {
    const first = s.sets[0];
    return {
      date: `${s.entry.month}/${s.entry.day}`,
      weight: typeof first.weight === 'number' ? first.weight : null,
      max: first.weight === 'max',
      reps: first.reps,
      setsText: s.setsText,
    };
  });
}

export function metricPoints(series: SeriesPoint[], metric: Metric): SeriesPoint[] {
  return series.filter(p => (metric === 'weight' ? p.weight : p.reps) !== null);
}

export function dashboardItems(doc: Doc, aliases: string[][]): DashboardItem[] {
  const items: DashboardItem[] = [];
  for (const { key, name, sessions } of exerciseList(doc, aliases)) {
    const series = exerciseSeries(doc, key, aliases);
    const weights = metricPoints(series, 'weight');
    const reps = metricPoints(series, 'reps');
    const preferWeight = weights.length * 2 >= series.length;
    const metric: Metric = (preferWeight && weights.length >= 2) || reps.length < 2 ? 'weight' : 'reps';
    const points = metric === 'reps' ? reps : weights;
    if (points.length < 2) continue;
    const values = points.map(p => (metric === 'reps' ? p.reps : p.weight) as number);
    items.push({ key, name, sessions, metric, values, latest: values[values.length - 1] });
  }
  return items;
}
