import { chartGeometry, nearestIndex } from '../core/chart';
import type { Geometry } from '../core/chart';

const NS = 'http://www.w3.org/2000/svg';

function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

const LINE = { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

export function sparkline(values: number[]): SVGSVGElement {
  const svg = node('svg', { class: 'spark', width: 88, height: 28 });
  const g = chartGeometry(values, 88, 28, { top: 3, right: 3, bottom: 3, left: 3 });
  svg.append(node('path', { d: g.path, stroke: '#F2F2F2', 'stroke-width': 1.5, ...LINE }));
  const last = g.points[g.points.length - 1];
  if (last) svg.append(node('circle', { cx: last.x, cy: last.y, r: 2, fill: '#F2F2F2' }));
  return svg;
}

const HEIGHT = 200;
const PAD = { top: 14, right: 48, bottom: 14, left: 8 };

export interface Chart {
  svg: SVGSVGElement;
  geometry: Geometry;
}

export function buildChart(
  values: number[],
  width: number,
  handlers: { onScrub(index: number): void; onEnd(): void },
): Chart {
  const g = chartGeometry(values, width, HEIGHT, PAD);
  const svg = node('svg', { class: 'chart', width, height: HEIGHT });
  const plotRight = width - PAD.right;

  const rules = g.max === g.min ? [g.max] : [g.max, g.min];
  const yOf = (v: number) => g.points[values.indexOf(v)].y;
  for (const v of rules) {
    const y = yOf(v);
    svg.append(node('line', { x1: PAD.left, x2: plotRight, y1: y, y2: y, stroke: '#262626', 'stroke-width': 1 }));
    const label = node('text', {
      x: width - 2,
      y,
      'text-anchor': 'end',
      'dominant-baseline': 'middle',
      'font-size': 13,
      fill: '#8A8A8A',
    });
    label.textContent = String(v);
    svg.append(label);
  }

  svg.append(node('path', { class: 'chart-line', d: g.path, stroke: '#F2F2F2', 'stroke-width': 2, ...LINE }));
  const last = g.points[g.points.length - 1];
  const idle = node('circle', { class: 'chart-last', cx: last.x, cy: last.y, r: 3, fill: '#F2F2F2' });
  svg.append(idle);

  const scrub = node('g', { class: 'chart-scrub', visibility: 'hidden' });
  const vline = node('line', {
    x1: 0,
    x2: 0,
    y1: PAD.top,
    y2: HEIGHT - PAD.bottom,
    stroke: '#8A8A8A',
    'stroke-width': 1,
  });
  const dot = node('circle', {
    class: 'chart-dot',
    r: 5,
    cx: 0,
    cy: 0,
    fill: '#F2F2F2',
    stroke: '#0A0A0A',
    'stroke-width': 3,
  });
  scrub.append(vline, dot);
  svg.append(scrub);

  let active = -1;
  const move = (e: PointerEvent) => {
    const x = e.clientX - svg.getBoundingClientRect().left;
    const i = nearestIndex(g.points, x);
    if (i < 0) return;
    const p = g.points[i];
    vline.setAttribute('x1', String(p.x));
    vline.setAttribute('x2', String(p.x));
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    scrub.setAttribute('visibility', 'visible');
    idle.setAttribute('visibility', 'hidden');
    if (i !== active) {
      active = i;
      handlers.onScrub(i);
    }
  };
  const end = () => {
    active = -1;
    scrub.setAttribute('visibility', 'hidden');
    idle.setAttribute('visibility', 'visible');
    handlers.onEnd();
  };
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    move(e);
  });
  svg.addEventListener('pointermove', e => {
    if (svg.hasPointerCapture(e.pointerId)) move(e);
  });
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  return { svg, geometry: g };
}
