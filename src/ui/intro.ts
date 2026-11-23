import { dPath, introAt } from '../core/dossier-mark';
import { EASE_IOS, reduced } from './sheet';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 160;
const FADE_MS = 240;
const STILL_MS = 400;

function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

/**
 * Plays the Dossier intro over a black screen at launch, then fades it away. It never blocks taps, so the log
 * underneath can be used straight away. Under reduced motion the finished mark shows briefly and is removed.
 */
export function playIntro(parent: HTMLElement = document.body): void {
  const overlay = document.createElement('div');
  overlay.className = 'intro';
  overlay.setAttribute('aria-hidden', 'true');

  const svg = svgNode('svg', { viewBox: '0 0 100 100', width: SIZE, height: SIZE });
  const defs = svgNode('defs', {});
  const top = svgNode('clipPath', { id: 'intro-top' });
  top.append(svgNode('rect', { x: -100, y: 0, width: 300, height: 50 }));
  const bottom = svgNode('clipPath', { id: 'intro-bottom' });
  bottom.append(svgNode('rect', { x: -100, y: 50, width: 300, height: 50 }));
  defs.append(top, bottom);

  const half = (clip: string) => {
    const g = svgNode('g', { 'clip-path': `url(#${clip})` });
    const path = svgNode('path', { d: dPath(), fill: 'currentColor' });
    g.append(path);
    return { g, path };
  };
  const upper = half('intro-top');
  const lower = half('intro-bottom');
  svg.append(defs, upper.g, lower.g);
  overlay.append(svg);
  parent.append(overlay);

  const draw = (t: number) => {
    const f = introAt(t);
    upper.g.setAttribute('transform', `translate(${+f.topX.toFixed(3)} 0)`);
    lower.g.setAttribute('transform', `translate(${+f.bottomX.toFixed(3)} 0)`);
    const o = String(+f.opacity.toFixed(3));
    upper.path.setAttribute('fill-opacity', o);
    lower.path.setAttribute('fill-opacity', o);
    return f.done;
  };

  if (reduced()) {
    draw(Infinity);
    window.setTimeout(() => overlay.remove(), STILL_MS);
    return;
  }

  draw(0);
  let start: number | null = null;
  const frame = (now: number) => {
    if (start === null) start = now;
    if (!draw((now - start) / 1000)) {
      requestAnimationFrame(frame);
      return;
    }
    const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: EASE_IOS, fill: 'forwards' });
    fade.finished.then(() => overlay.remove(), () => overlay.remove());
  };
  requestAnimationFrame(frame);
}
