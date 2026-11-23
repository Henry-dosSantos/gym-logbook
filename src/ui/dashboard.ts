import { dashboardItems, exerciseSeries, metricPoints } from '../core/stats';
import type { DashboardItem, Metric, SeriesPoint } from '../core/stats';
import type { Doc } from '../core/types';
import { platform } from '../platform';
import { buildChart, sparkline } from './chart';
import { button, el } from './dom';
import { reduced } from './sheet';
import { createStack, pageHeader } from './stack';
import type { Page } from './stack';

function valueOf(p: SeriesPoint, metric: Metric): number {
  return (metric === 'reps' ? p.reps : p.weight) as number;
}

function buildDetail(doc: Doc, aliases: string[][], item: DashboardItem, onBack: () => void): Page {
  const series = exerciseSeries(doc, item.key, aliases);
  const counts: Record<Metric, number> = {
    weight: metricPoints(series, 'weight').length,
    reps: metricPoints(series, 'reps').length,
  };
  let metric: Metric = item.metric;
  let points = metricPoints(series, metric);

  const root = el('div', 'detail');

  const header = pageHeader(item.name, onBack, 'detail-name');

  const readout = el('div', 'readout');
  const readoutDate = el('div', 'readout-date');
  const line = el('div', 'readout-line');
  const readoutValue = el('span', 'readout-value');
  const readoutSuffix = el('span', 'readout-suffix');
  line.append(readoutValue, readoutSuffix);
  readout.append(readoutDate, line);

  const showReadout = (p: SeriesPoint) => {
    readoutDate.textContent = p.date;
    readoutValue.textContent = String(valueOf(p, metric));
    if (metric === 'weight') readoutSuffix.textContent = p.reps !== null ? `× ${p.reps}` : '';
    else if (p.weight !== null) readoutSuffix.textContent = `reps at ${p.weight}`;
    else readoutSuffix.textContent = p.max ? 'reps at max' : 'reps';
  };

  const seg = el('div', 'seg');
  seg.setAttribute('role', 'tablist');
  const thumb = el('div', 'seg-thumb');
  seg.append(thumb);
  const tabs = new Map<Metric, HTMLButtonElement>();
  for (const [m, label] of [['weight', 'Weight'], ['reps', 'Reps']] as const) {
    const tab = el('button', 'seg-tab', label);
    tab.type = 'button';
    tab.dataset.metric = m;
    tab.setAttribute('role', 'tab');
    tab.disabled = counts[m] < 2;
    tab.addEventListener('click', () => select(m));
    tabs.set(m, tab);
    seg.append(tab);
  }

  const chartWrap = el('div', 'chart-wrap');
  const axis = el('div', 'chart-axis');
  const axisFirst = el('span');
  const axisLast = el('span');
  axis.append(axisFirst, axisLast);

  const stats = el('div', 'stats');
  const stat = (name: string, key: string) => {
    const cell = el('div', 'stat');
    const value = el('div', 'stat-value');
    value.dataset.stat = key;
    const sub = el('div', 'stat-sub');
    cell.append(el('div', 'stat-label', name), value, sub);
    stats.append(cell);
    return { value, sub };
  };
  const best = stat('Best', 'best');
  const latest = stat('Latest', 'latest');
  const sessions = stat('Sessions', 'sessions');

  const recent = el('div', 'recent');
  for (const p of series.slice(-8).reverse()) {
    const row = el('div', 'recent-row');
    row.append(el('span', 'recent-date', p.date), el('span', 'recent-sets', p.setsText));
    recent.append(row);
  }

  const renderChart = (fade: boolean) => {
    const width = chartWrap.clientWidth || root.clientWidth - 24;
    const { svg } = buildChart(points.map(p => valueOf(p, metric)), width, {
      onScrub: i => {
        showReadout(points[i]);
        platform.haptic();
      },
      onEnd: () => showReadout(points[points.length - 1]),
    });
    drawnWidth = width;
    chartWrap.replaceChildren(svg);
    if (fade && !reduced()) svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
  };

  const renderStats = () => {
    const values = points.map(p => valueOf(p, metric));
    const top = Math.max(...values);
    const first = points[values.indexOf(top)];
    const last = points[points.length - 1];
    best.value.textContent = String(top);
    best.sub.textContent = first.date;
    latest.value.textContent = String(valueOf(last, metric));
    latest.sub.textContent = last.date;
    sessions.value.textContent = String(series.length);
    axisFirst.textContent = points[0].date;
    axisLast.textContent = last.date;
  };

  const select = (m: Metric, fade = true) => {
    if (counts[m] < 2) return;
    metric = m;
    points = metricPoints(series, m);
    for (const [key, tab] of tabs) tab.setAttribute('aria-selected', String(key === m));
    thumb.style.transform = m === 'weight' ? 'translateX(0)' : 'translateX(100%)';
    showReadout(points[points.length - 1]);
    renderStats();
    renderChart(fade);
  };

  root.append(header, readout, seg, chartWrap, axis, stats, el('div', 'section-label', 'Recent'), recent);
  let drawnWidth = 0;
  new ResizeObserver(() => {
    const width = chartWrap.clientWidth;
    if (drawnWidth && width && width !== drawnWidth) renderChart(false);
  }).observe(chartWrap);
  return { el: root, className: 'dash-detail', mounted: () => select(metric, false) };
}

export function dashboardView(doc: Doc, aliases: string[][]): HTMLElement {
  const list = el('div', 'dash-items');
  const items = dashboardItems(doc, aliases);
  if (!items.length) list.append(el('div', 'empty', 'No data'));

  const stack = createStack({ el: list, className: 'dash-list' });

  for (const item of items) {
    const row = button('row dash-row', 'dash-row', '', () =>
      stack.push(buildDetail(doc, aliases, item, () => stack.pop())),
    );
    row.removeAttribute('data-action');
    row.dataset.key = item.key;
    const left = el('div', 'dash-left');
    left.append(el('div', 'dash-name', item.name), el('div', 'dash-meta', `${item.sessions} sessions`));
    const latest = el('span', 'dash-latest', item.metric === 'reps' ? `×${item.latest}` : String(item.latest));
    row.append(left, sparkline(item.values), latest);
    list.append(row);
  }
  return stack.el;
}
