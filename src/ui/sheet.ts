export interface SheetHandle {
  close(): void;
}

export const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DISMISS_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const MOVE_MS = 320;
const SCRIM_OPACITY = 0.4;
const DRAG_START = 6;
const FLING = 0.5;
export const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let current: SheetHandle | null = null;

export function openSheet(opts: {
  label: string;
  content: HTMLElement;
  flush?: boolean;
  onClose?(): void;
}): SheetHandle {
  current?.close();
  (document.activeElement as HTMLElement | null)?.blur();

  const app = document.getElementById('app')!;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet glass';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', opts.label);

  const head = document.createElement('div');
  head.className = 'sheet-head';
  const grip = document.createElement('div');
  grip.className = 'sheet-grip';
  const bar = document.createElement('div');
  bar.className = 'sheet-bar';
  grip.append(bar);
  const title = document.createElement('div');
  title.className = 'sheet-title';
  title.textContent = opts.label;
  head.append(grip, title);

  const body = document.createElement('div');
  body.className = opts.flush ? 'sheet-body is-flush' : 'sheet-body';
  body.append(opts.content);
  sheet.append(head, body);
  app.append(scrim, sheet);

  let closed = false;
  let detent: 'medium' | 'large' = 'medium';
  let offset = 0;
  let animation: Animation | null = null;

  const height = () => sheet.offsetHeight;
  const mediumOffset = () => Math.max(0, height() - 0.5 * app.clientHeight);

  const animate = (el: HTMLElement, frames: Keyframe[], duration: number, easing: string, fill: FillMode = 'none') =>
    reduced() ? null : el.animate(frames, { duration, easing, fill });

  const place = (y: number) => {
    sheet.style.transform = `translateY(${y}px)`;
  };

  const rest = (target: 'medium' | 'large') => {
    detent = target;
    offset = target === 'large' ? 0 : mediumOffset();
    sheet.dataset.detent = target;
    sheet.style.setProperty('--sheet-offset', `${offset}px`);
  };

  const moveTo = (target: 'medium' | 'large', from: number) => {
    animation?.cancel();
    rest(target);
    place(offset);
    animation = animate(
      sheet,
      [{ transform: `translateY(${from}px)` }, { transform: `translateY(${offset}px)` }],
      MOVE_MS,
      EASE_IOS,
    );
    scrim.style.opacity = '';
  };

  const scrimAt = (y: number) => {
    const m = mediumOffset();
    const span = Math.max(1, height() - m);
    return SCRIM_OPACITY * (1 - Math.min(1, Math.max(0, y - m) / span));
  };

  rest('medium');
  place(offset);
  animation = animate(
    sheet,
    [{ transform: `translateY(${height()}px)` }, { transform: `translateY(${offset}px)` }],
    MOVE_MS,
    EASE_IOS,
  );
  animate(scrim, [{ opacity: 0 }, { opacity: SCRIM_OPACITY }], MOVE_MS, EASE_IOS);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handle.close();
  };
  document.addEventListener('keydown', onKey);

  const relayout = () => {
    if (closed) return;
    rest(detent);
    place(offset);
  };
  window.addEventListener('resize', relayout);
  window.visualViewport?.addEventListener('resize', relayout);

  const finish = () => {
    scrim.remove();
    sheet.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', relayout);
    window.visualViewport?.removeEventListener('resize', relayout);
    if (current === handle) current = null;
    opts.onClose?.();
  };

  const dismiss = (from: number, duration = MOVE_MS, scrimFrom = SCRIM_OPACITY) => {
    if (closed) return;
    closed = true;
    animation?.cancel();
    const h = height();
    const a = animate(
      sheet,
      [{ transform: `translateY(${from}px)` }, { transform: `translateY(${h}px)` }],
      duration,
      DISMISS_EASING,
      'forwards',
    );
    const b = animate(scrim, [{ opacity: scrimFrom }, { opacity: 0 }], duration, DISMISS_EASING, 'forwards');
    if (a && b) a.finished.then(finish, finish);
    else finish();
  };

  const handle: SheetHandle = { close: () => dismiss(offset) };
  current = handle;

  scrim.addEventListener('click', () => handle.close());

  sheet.addEventListener('focusin', e => {
    const t = e.target as HTMLElement;
    if (detent === 'medium' && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) moveTo('large', offset);
  });

  let startY = 0;
  let startOffset = 0;
  let pointer = -1;
  let dragging = false;
  let fromHead = false;
  let swallow = false;
  let samples: { t: number; y: number }[] = [];

  const visual = (clientY: number) => {
    const raw = startOffset + (clientY - startY);
    return raw < 0 ? raw / 4 : Math.min(raw, height());
  };

  sheet.addEventListener('pointerdown', e => {
    if (closed || !e.isPrimary) return;
    fromHead = head.contains(e.target as Node);
    if (!fromHead && (detent !== 'medium' || (e.target as Element).closest('[data-no-drag]'))) return;
    pointer = e.pointerId;
    startY = e.clientY;
    startOffset = offset;
    dragging = false;
    samples = [{ t: e.timeStamp, y: e.clientY }];
    if (fromHead) {
      dragging = true;
      sheet.setPointerCapture(e.pointerId);
      animation?.cancel();
    }
  });

  sheet.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return;
    if (!dragging) {
      if (Math.abs(e.clientY - startY) <= DRAG_START) return;
      dragging = true;
      startY = e.clientY;
      sheet.setPointerCapture(e.pointerId);
      animation?.cancel();
    }
    samples.push({ t: e.timeStamp, y: e.clientY });
    const y = visual(e.clientY);
    place(y);
    scrim.style.opacity = String(scrimAt(y));
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    if (!dragging) return;
    dragging = false;
    swallow = true;
    window.setTimeout(() => (swallow = false), 0);
    const y = visual(e.clientY);
    const recent = samples.filter(s => e.timeStamp - s.t <= 100);
    const first = recent[0] ?? samples[0];
    const dt = e.timeStamp - first.t;
    const v = dt > 0 ? (e.clientY - first.y) / dt : 0;
    const m = mediumOffset();
    const h = height();
    const scrimFrom = scrimAt(y);
    let target: 'large' | 'medium' | 'dismiss';
    if (v < -FLING) target = 'large';
    else if (v > FLING) target = y < m ? 'medium' : 'dismiss';
    else if (y > m + 0.3 * (h - m)) target = 'dismiss';
    else target = Math.abs(y) < Math.abs(y - m) ? 'large' : 'medium';

    scrim.style.opacity = '';
    if (target === 'dismiss') {
      const duration = Math.min(260, Math.max(120, (h - y) / Math.max(Math.abs(v), 1.2)));
      dismiss(y, duration, scrimFrom);
    } else {
      moveTo(target, y);
      if (scrimFrom < SCRIM_OPACITY) animate(scrim, [{ opacity: scrimFrom }, { opacity: SCRIM_OPACITY }], MOVE_MS, EASE_IOS);
    }
  };
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);

  sheet.addEventListener(
    'click',
    e => {
      if (swallow) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );

  return handle;
}

export function closeSheet(): void {
  current?.close();
}
