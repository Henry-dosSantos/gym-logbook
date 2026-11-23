export interface Pad { top: number; right: number; bottom: number; left: number }
export interface Point { x: number; y: number }
export interface Geometry { points: (Point | null)[]; path: string; min: number; max: number }

const round = (n: number) => Math.round(n * 100) / 100;

export function chartGeometry(values: (number | null)[], width: number, height: number, pad: Pad): Geometry {
  const present = values.filter((v): v is number => v !== null);
  if (!values.length) return { points: [], path: '', min: 0, max: 0 };
  if (!present.length) return { points: values.map(() => null), path: '', min: 0, max: 0 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const n = values.length;
  const points = values.map((v, i) =>
    v === null
      ? null
      : {
          x: round(n === 1 ? pad.left + plotW / 2 : pad.left + (i * plotW) / (n - 1)),
          y: round(max === min ? pad.top + plotH / 2 : pad.top + ((max - v) / (max - min)) * plotH),
        },
  );
  let path = '';
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    path += `${pen ? 'L' : 'M'}${p.x} ${p.y}`;
    pen = true;
  }
  return { points, path, min, max };
}

export function nearestIndex(points: ({ x: number } | null)[], x: number): number {
  let best = -1;
  let bestDist = Infinity;
  points.forEach((p, i) => {
    if (!p) return;
    const d = Math.abs(p.x - x);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
