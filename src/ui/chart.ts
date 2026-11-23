import { chartGeometry, nearestIndex } from '../core/chart';
import type { Geometry, Pad } from '../core/chart';

const NS = 'http://www.w3.org/2000/svg';

function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

const LINE = { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

export function sparkline(values: (number | null)[]): SVGSVGElement {
  const svg = node('svg', { class: 'spark', width: 88, height: 28 });
  const g = chartGeometry(values, 88, 28, { top: 3, right: 3, bottom: 3, left: 3 });
  svg.append(node('path', { d: g.path, stroke: '#F2F2F2', 'stroke-width': 1.5, ...LINE }));
  const last = [...g.points].reverse().find(p => p !== null);
  if (last) svg.append(node('circle', { cx: last.x, cy: last.y, r: 2, fill: '#F2F2F2' }));
  return svg;
}

export const PAD: Pad = { top: 14, right: 48, bottom: 14, left: 8 };

export interface ChartSpec {
  className: string;
  values: (number | null)[];
  height: number;
  stroke: string;
  strokeWidth: number;
}

export interface Chart {
  svg: SVGSVGElement;
  geometry: Geometry;
  show(index: number): void;
  hide(): void;
}

export function buildChart(spec: ChartSpec, width: number): Chart {
  const { values, height } = spec;
  const g = chartGeometry(values, width, height, PAD);
  const svg = node('svg', { class: `chart ${spec.className}`, width, height });
  const plotRight = width - PAD.right;

  if (g.path) {
    const rules = g.max === g.min ? [g.max] : [g.max, g.min];
    for (const v of rules) {
      const y = g.points[values.indexOf(v)]!.y;
      svg.append(node('line', { x1: PAD.left, x2: plotRight, y1: y, y2: y, stroke: '#262626', 'stroke-width': 1 }));
      const label = node('text', {
        x: width - 2,
        y,
        'text-anchor': 'end',
        'dominant-baseline': 'middle',
        'font-size': 13,
        fill: '#8A8A8A',
      });
      label.textContent = String(Math.round(v));
      svg.append(label);
    }
  }

  svg.append(node('path', { class: 'chart-line', d: g.path, stroke: spec.stroke, 'stroke-width': spec.strokeWidth, ...LINE }));
  const last = [...g.points].reverse().find(p => p !== null);
  const idle = node('circle', { class: 'chart-last', cx: last?.x ?? 0, cy: last?.y ?? 0, r: 3, fill: spec.stroke });
  if (!last) idle.setAttribute('visibility', 'hidden');
  svg.append(idle);

  const vline = node('line', {
    class: 'chart-scrub',
    x1: 0,
    x2: 0,
    y1: 0,
    y2: height,
    stroke: '#8A8A8A',
    'stroke-width': 1,
    visibility: 'hidden',
  });
  const dot = node('circle', {
    class: 'chart-dot',
    r: 5,
    cx: 0,
    cy: 0,
    fill: spec.stroke,
    stroke: '#0A0A0A',
    'stroke-width': 3,
    visibility: 'hidden',
  });
  svg.append(vline, dot);

  return {
    svg,
    geometry: g,
    show(index) {
      const n = values.length;
      const x = n === 1 ? PAD.left + (width - PAD.left - PAD.right) / 2 : PAD.left + (index * (width - PAD.left - PAD.right)) / (n - 1);
      vline.setAttribute('x1', String(x));
      vline.setAttribute('x2', String(x));
      vline.setAttribute('visibility', 'visible');
      const p = g.points[index];
      if (p) {
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
      }
      dot.setAttribute('visibility', p ? 'visible' : 'hidden');
      idle.setAttribute('visibility', 'hidden');
    },
    hide() {
      vline.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      if (last) idle.setAttribute('visibility', 'visible');
    },
  };
}

/** Index of the slot nearest to x in an n-long series; slots marked absent in `present` are skipped. */
export function slotAt(n: number, width: number, x: number, present?: boolean[]): number {
  if (!n) return -1;
  const plotW = width - PAD.left - PAD.right;
  const slots = Array.from({ length: n }, (_, i) =>
    present && !present[i] ? null : { x: n === 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (n - 1) },
  );
  return nearestIndex(slots, x);
}

/** One scrub gesture over a group of stacked charts that share an x axis. */
export function scrubGroup(
  area: HTMLElement,
  opts: { charts(): Chart[]; indexAt(x: number, width: number): number; onScrub(index: number): void; onEnd(): void },
): void {
  let active = -1;
  let pointer = -1;
  const move = (e: PointerEvent) => {
    const rect = area.getBoundingClientRect();
    const i = opts.indexAt(e.clientX - rect.left, rect.width);
    if (i < 0) return;
    for (const c of opts.charts()) c.show(i);
    if (i !== active) {
      active = i;
      opts.onScrub(i);
    }
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    active = -1;
    for (const c of opts.charts()) c.hide();
    opts.onEnd();
  };
  area.addEventListener('pointerdown', e => {
    if (!opts.charts().length) return;
    pointer = e.pointerId;
    area.setPointerCapture(e.pointerId);
    move(e);
  });
  area.addEventListener('pointermove', e => {
    if (e.pointerId === pointer) move(e);
  });
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);
}
