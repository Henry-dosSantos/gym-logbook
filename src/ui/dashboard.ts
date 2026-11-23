import { dashboardItems, exerciseSeries } from '../core/stats';
import type { DashboardItem, Mode, SeriesPoint } from '../core/stats';
import type { Doc } from '../core/types';
import { platform } from '../platform';
import { buildChart, scrubGroup, slotAt, sparkline } from './chart';
import type { Chart, ChartSpec } from './chart';
import { button, el } from './dom';
import { reduced } from './sheet';
import { createStack, pageHeader } from './stack';
import type { Page } from './stack';

const MODES: [Mode, string][] = [
  ['sets', 'Weight × reps'],
  ['1rm', '1RM'],
];

const FORMULA = 'Wathan formula: 1RM = 100w ÷ (48.8 + 53.8e^(−0.075r)), w = weight, r = reps';
const FOOTER = 'From the best set of each session. Less reliable above 10 reps.';
const NO_ESTIMATE = 'No estimate: this exercise is logged at max or without weights.';

interface ModeState {
  get(): Mode;
  set(mode: Mode): void;
}

function modeToggle(state: ModeState, onChange: () => void): { el: HTMLElement; sync(): void } {
  const seg = el('div', 'seg');
  seg.setAttribute('role', 'tablist');
  const thumb = el('div', 'seg-thumb');
  seg.append(thumb);
  const tabs = new Map<Mode, HTMLButtonElement>();
  for (const [mode, label] of MODES) {
    const tab = el('button', 'seg-tab', label);
    tab.type = 'button';
    tab.dataset.mode = mode;
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => {
      if (state.get() === mode) return;
      state.set(mode);
      sync();
      onChange();
    });
    tabs.set(mode, tab);
    seg.append(tab);
  }
  const sync = () => {
    const mode = state.get();
    for (const [key, tab] of tabs) tab.setAttribute('aria-selected', String(key === mode));
    thumb.style.transform = mode === 'sets' ? 'translateX(0)' : 'translateX(100%)';
  };
  sync();
  return { el: seg, sync };
}

const fadeIn = (node: HTMLElement) => {
  if (!reduced()) node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
};

const round = (n: number | null) => (n === null ? '–' : String(Math.round(n)));

function firstMax(series: SeriesPoint[], value: (p: SeriesPoint) => number | null): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  let top = -Infinity;
  for (const p of series) {
    const v = value(p);
    if (v !== null && v > top) {
      top = v;
      best = p;
    }
  }
  return best;
}

function buildDetail(doc: Doc, aliases: string[][], item: DashboardItem, state: ModeState, onBack: () => void): Page {
  const series = exerciseSeries(doc, item.key, aliases);
  const last = series[series.length - 1];
  const weights = series.map(p => p.weight);
  const reps = series.map(p => p.reps);
  const oneRms = series.map(p => (p.oneRm === null ? null : Math.round(p.oneRm)));
  const hasOneRm = oneRms.some(v => v !== null);

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
    if (state.get() === '1rm') {
      readoutValue.textContent = round(p.oneRm);
      readoutSuffix.textContent = 'est. 1RM';
    } else if (p.weight !== null || p.max) {
      readoutValue.textContent = p.weight !== null ? String(p.weight) : 'max';
      readoutSuffix.textContent = p.reps !== null ? `× ${p.reps}` : '';
    } else {
      readoutValue.textContent = p.reps !== null ? String(p.reps) : '–';
      readoutSuffix.textContent = p.reps !== null ? 'reps' : '';
    }
  };

  const toggle = modeToggle(state, () => render(true));

  const body = el('div', 'dash-body');
  const area = el('div', 'chart-area');
  area.dataset.noDrag = '';
  const axis = el('div', 'chart-axis');
  const axisFirst = el('span', '', series[0].date);
  const axisLast = el('span', '', last.date);
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
  sessions.value.textContent = String(series.length);

  const recent = el('div', 'recent');
  const footer = el('div', 'dash-footer', FOOTER);
  body.append(area, axis, stats, el('div', 'section-label', 'Recent'), recent, footer);

  let charts: Chart[] = [];
  let drawnWidth = 0;

  const specs = (): { label: string | null; spec: ChartSpec }[] => {
    if (state.get() === '1rm') {
      if (!hasOneRm) return [];
      return [{ label: null, spec: { className: 'chart-1rm', values: oneRms, height: 200, stroke: '#F2F2F2', strokeWidth: 2 } }];
    }
    const out: { label: string | null; spec: ChartSpec }[] = [];
    if (weights.some(v => v !== null))
      out.push({ label: 'Weight', spec: { className: 'chart-weight', values: weights, height: 150, stroke: '#F2F2F2', strokeWidth: 2 } });
    if (reps.some(v => v !== null))
      out.push({ label: 'Reps', spec: { className: 'chart-reps', values: reps, height: 90, stroke: '#8A8A8A', strokeWidth: 1.5 } });
    return out;
  };

  const drawCharts = () => {
    const width = area.clientWidth || root.clientWidth - 24;
    drawnWidth = width;
    const list = specs();
    charts = [];
    const nodes: HTMLElement[] = [];
    if (state.get() === '1rm' && !hasOneRm) nodes.push(el('div', 'dash-note', NO_ESTIMATE));
    for (const { label, spec } of list) {
      const chart = buildChart(spec, width);
      charts.push(chart);
      if (label) nodes.push(el('div', 'chart-label', label));
      nodes.push(chart.svg as unknown as HTMLElement);
    }
    area.replaceChildren(...nodes);
    axis.hidden = !charts.length;
  };

  const renderStats = () => {
    if (state.get() === '1rm') {
      const top = firstMax(series, p => (p.oneRm === null ? null : Math.round(p.oneRm)));
      best.value.textContent = top ? round(top.oneRm) : '–';
      best.sub.textContent = top?.date ?? '';
      const lastEst = [...series].reverse().find(p => p.oneRm !== null) ?? null;
      latest.value.textContent = lastEst ? round(lastEst.oneRm) : '–';
      latest.sub.textContent = lastEst?.date ?? '';
    } else {
      const top = firstMax(series, p => p.weight);
      best.value.textContent = top ? String(top.weight) : '–';
      best.sub.textContent = top?.date ?? '';
      latest.value.textContent = item.latestText;
      latest.sub.textContent = last.date;
    }
  };

  const renderRecent = () => {
    const rows = series.slice(-8).reverse().map(p => {
      const row = el('div', 'recent-row');
      row.append(el('span', 'recent-date', p.date));
      if (state.get() === '1rm') {
        row.append(el('span', 'recent-est', round(p.oneRm)));
        if (p.oneRmFrom) row.append(el('span', 'recent-from', `from ${p.oneRmFrom.weight} × ${p.oneRmFrom.reps}`));
      } else {
        row.append(el('span', 'recent-sets', p.setsText));
      }
      return row;
    });
    recent.replaceChildren(...rows);
  };

  const render = (fade: boolean) => {
    toggle.sync();
    footer.hidden = state.get() !== '1rm';
    syncFormula();
    showReadout(last);
    renderStats();
    renderRecent();
    drawCharts();
    if (fade) fadeIn(body);
  };

  scrubGroup(area, {
    charts: () => charts,
    indexAt: (x, width) =>
      state.get() === '1rm' ? slotAt(series.length, width, x, oneRms.map(v => v !== null)) : slotAt(series.length, width, x),
    onScrub: i => {
      showReadout(series[i]);
      platform.haptic();
    },
    onEnd: () => showReadout(last),
  });

  const formula = el('div', 'dash-formula', FORMULA);
  const syncFormula = () => (formula.hidden = state.get() !== '1rm');
  root.append(header, readout, toggle.el, formula, body);
  new ResizeObserver(() => {
    const width = area.clientWidth;
    if (drawnWidth && width && width !== drawnWidth) drawCharts();
  }).observe(area);
  return { el: root, className: 'dash-detail', mounted: () => render(false), refresh: () => render(false) };
}

export function dashboardView(doc: Doc, aliases: string[][]): HTMLElement {
  let mode: Mode = 'sets';
  const state: ModeState = { get: () => mode, set: m => (mode = m) };

  const page = el('div', 'dash-page');
  const list = el('div', 'dash-items');
  const items = dashboardItems(doc, aliases);
  const rows: { item: DashboardItem; row: HTMLElement }[] = [];

  const renderRow = (item: DashboardItem, row: HTMLElement) => {
    const left = el('div', 'dash-left');
    left.append(el('div', 'dash-name', item.name), el('div', 'dash-meta', `${item.sessions} sessions`));
    const sets = mode === 'sets';
    const value = el('span', 'dash-latest', sets ? item.latestText : round(item.oneRmLatest));
    row.replaceChildren(left, sparkline(sets ? item.spark : item.oneRmSpark), value);
  };
  const renderRows = () => {
    for (const { item, row } of rows) renderRow(item, row);
  };

  const formula = el('div', 'dash-formula', FORMULA);
  const toggle = modeToggle(state, () => {
    renderRows();
    formula.hidden = mode !== '1rm';
    fadeIn(list);
  });

  const stack = createStack({
    el: page,
    className: 'dash-list',
    refresh: () => {
      toggle.sync();
      formula.hidden = mode !== '1rm';
      renderRows();
    },
  });

  if (!items.length) list.append(el('div', 'empty', 'No data'));
  for (const item of items) {
    const row = button('row dash-row', 'dash-row', '', () =>
      stack.push(buildDetail(doc, aliases, item, state, () => stack.pop())),
    );
    row.removeAttribute('data-action');
    row.dataset.key = item.key;
    rows.push({ item, row });
    list.append(row);
  }
  renderRows();
  formula.hidden = true;
  if (items.length) page.append(toggle.el, formula);
  page.append(list);
  return stack.el;
}
