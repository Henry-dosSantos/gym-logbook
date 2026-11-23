import type { EditorView } from '@codemirror/view';
import { EASE_IOS, reduced } from './sheet';

const MAX_MS = 350;
const HOLD_MS = 450;
const MAX_MOVE = 8;
const SIZE = 64;
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function installTapFlash(app: HTMLElement, host: HTMLElement, view: EditorView): void {
  let start: { x: number; y: number; t: number; id: number } | null = null;

  const blank = (x: number, y: number): boolean => {
    if (view.posAtCoords({ x, y }) === null) return true;
    const pos = view.posAtCoords({ x, y }, false);
    return view.state.doc.lineAt(pos).text === '';
  };

  const wave = (x: number, y: number, ring: boolean, to: number, duration: number, delay = 0) => {
    const box = app.getBoundingClientRect();
    const dot = document.createElement('div');
    dot.className = ring ? 'tap-flash is-ring' : 'tap-flash';
    dot.style.left = `${x - box.left - SIZE / 2}px`;
    dot.style.top = `${y - box.top - SIZE / 2}px`;
    dot.style.opacity = '0';
    app.append(dot);
    const anim = dot.animate(
      [
        { opacity: 1, transform: 'scale(0.3)' },
        { opacity: 0, transform: `scale(${to})` },
      ],
      { duration, delay, easing: ring ? EASE_OUT : EASE_IOS },
    );
    anim.finished.then(() => dot.remove(), () => dot.remove());
  };

  /** A drop in still water: a soft fill and two rings spreading out from the touch. */
  const flash = (x: number, y: number) => {
    wave(x, y, false, 1.4, 360);
    wave(x, y, true, 2.6, 640);
    wave(x, y, true, 3.4, 760, 110);
  };

  let hold: number | undefined;
  const cancelHold = () => {
    window.clearTimeout(hold);
    hold = undefined;
  };

  host.addEventListener(
    'pointerdown',
    e => {
      start = e.isPrimary ? { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId } : null;
      cancelHold();
      const s = start;
      if (!s || reduced() || !blank(s.x, s.y)) return;
      // Holding for the Paste / Copy menu ripples too, once, while the finger is still down.
      hold = window.setTimeout(() => {
        hold = undefined;
        if (start === s) {
          start = null;
          flash(s.x, s.y);
        }
      }, HOLD_MS);
    },
    { passive: true },
  );
  host.addEventListener(
    'pointerup',
    e => {
      const s = start;
      start = null;
      cancelHold();
      if (!s || s.id !== e.pointerId || reduced()) return;
      if (e.timeStamp - s.t > MAX_MS || Math.hypot(e.clientX - s.x, e.clientY - s.y) >= MAX_MOVE) return;
      if (blank(e.clientX, e.clientY)) flash(e.clientX, e.clientY);
    },
    { passive: true },
  );
  host.addEventListener(
    'pointermove',
    e => {
      if (start && e.pointerId === start.id && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= MAX_MOVE) {
        start = null;
        cancelHold();
      }
    },
    { passive: true },
  );
  host.addEventListener('pointercancel', () => {
    if (hold === undefined) start = null;
  }, { passive: true });
}
