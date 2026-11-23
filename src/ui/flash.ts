import type { EditorView } from '@codemirror/view';
import { EASE_IOS, reduced } from './sheet';

const MAX_MS = 350;
const MAX_MOVE = 8;
const SIZE = 64;

export function installTapFlash(app: HTMLElement, host: HTMLElement, view: EditorView): void {
  let start: { x: number; y: number; t: number; id: number } | null = null;

  const blank = (x: number, y: number): boolean => {
    if (view.posAtCoords({ x, y }) === null) return true;
    const pos = view.posAtCoords({ x, y }, false);
    return view.state.doc.lineAt(pos).text === '';
  };

  const flash = (x: number, y: number) => {
    const box = app.getBoundingClientRect();
    const dot = document.createElement('div');
    dot.className = 'tap-flash';
    dot.style.left = `${x - box.left - SIZE / 2}px`;
    dot.style.top = `${y - box.top - SIZE / 2}px`;
    app.append(dot);
    const anim = dot.animate(
      [
        { opacity: 1, transform: 'scale(0.5)' },
        { opacity: 0, transform: 'scale(1.25)' },
      ],
      { duration: 320, easing: EASE_IOS },
    );
    anim.finished.then(() => dot.remove(), () => dot.remove());
  };

  host.addEventListener(
    'pointerdown',
    e => {
      start = e.isPrimary ? { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId } : null;
    },
    { passive: true },
  );
  host.addEventListener(
    'pointerup',
    e => {
      const s = start;
      start = null;
      if (!s || s.id !== e.pointerId || reduced()) return;
      if (e.timeStamp - s.t > MAX_MS || Math.hypot(e.clientX - s.x, e.clientY - s.y) >= MAX_MOVE) return;
      if (blank(e.clientX, e.clientY)) flash(e.clientX, e.clientY);
    },
    { passive: true },
  );
  host.addEventListener('pointercancel', () => (start = null), { passive: true });
}
