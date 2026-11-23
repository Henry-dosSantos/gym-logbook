export interface Pad { top: number; right: number; bottom: number; left: number }
export interface Geometry { points: { x: number; y: number }[]; path: string; min: number; max: number }

const round = (n: number) => Math.round(n * 100) / 100;

export function chartGeometry(values: number[], width: number, height: number, pad: Pad): Geometry {
  if (!values.length) return { points: [], path: '', min: 0, max: 0 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const n = values.length;
  const points = values.map((v, i) => ({
    x: round(n === 1 ? pad.left + plotW / 2 : pad.left + (i * plotW) / (n - 1)),
    y: round(max === min ? pad.top + plotH / 2 : pad.top + ((max - v) / (max - min)) * plotH),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
  return { points, path, min, max };
}

export function nearestIndex(points: { x: number }[], x: number): number {
  let best = -1;
  let bestDist = Infinity;
  points.forEach((p, i) => {
    const d = Math.abs(p.x - x);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
