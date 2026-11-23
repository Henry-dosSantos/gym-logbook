export interface SheetHandle {
  close(): void;
  setContent(label: string, content: HTMLElement, opts?: { full?: boolean; flush?: boolean }): void;
}

export const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DURATION = 220;
const EASING = 'cubic-bezier(0.2,0.8,0.2,1)';
const SCRIM_OPACITY = 0.6;
export const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let current: SheetHandle | null = null;

export function openSheet(opts: { label: string; content: HTMLElement; onClose?(): void }): SheetHandle {
  current?.close();
  (document.activeElement as HTMLElement | null)?.blur();

  const app = document.getElementById('app')!;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
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
  body.className = 'sheet-body';
  body.append(opts.content);
  sheet.append(head, body);
  app.append(scrim, sheet);

  let closed = false;
  const animate = (
    el: HTMLElement,
    frames: Keyframe[],
    duration = DURATION,
    easing = EASING,
    fill: FillMode = 'none',
  ) => (reduced() ? null : el.animate(frames, { duration, easing, fill }));

  animate(sheet, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]);
  animate(scrim, [{ opacity: 0 }, { opacity: SCRIM_OPACITY }]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handle.close();
  };
  document.addEventListener('keydown', onKey);

  const finish = () => {
    scrim.remove();
    sheet.remove();
    document.removeEventListener('keydown', onKey);
    if (current === handle) current = null;
    opts.onClose?.();
  };

  const dismiss = (from: string, duration = DURATION, scrimFrom = SCRIM_OPACITY) => {
    if (closed) return;
    closed = true;
    const a = animate(sheet, [{ transform: from }, { transform: 'translateY(100%)' }], duration, EASING, 'forwards');
    const b = animate(scrim, [{ opacity: scrimFrom }, { opacity: 0 }], duration, EASING, 'forwards');
    if (a && b) a.finished.then(finish, finish);
    else finish();
  };

  const handle: SheetHandle = {
    close: () => dismiss('translateY(0)'),
    setContent(label, content, options = {}) {
      const before = sheet.getBoundingClientRect().height;
      sheet.setAttribute('aria-label', label);
      title.textContent = label;
      sheet.classList.toggle('is-full', !!options.full);
      body.classList.toggle('is-flush', !!options.flush);
      body.replaceChildren(content);
      const after = sheet.getBoundingClientRect().height;
      if (before !== after) {
        animate(sheet, [{ transform: `translateY(${after - before}px)` }, { transform: 'translateY(0)' }], 320, EASE_IOS);
      }
      animate(content, [{ opacity: 0 }, { opacity: 1 }], 180, 'linear');
    },
  };
  current = handle;

  scrim.addEventListener('click', () => handle.close());

  let startY = 0;
  let dragging = false;
  let samples: { t: number; y: number }[] = [];
  const offset = (y: number) => Math.max(0, y - startY);
  const scrimAt = (dy: number) => SCRIM_OPACITY * Math.max(0, 1 - dy / sheet.offsetHeight);
  head.addEventListener('pointerdown', e => {
    if (closed) return;
    dragging = true;
    startY = e.clientY;
    samples = [{ t: e.timeStamp, y: e.clientY }];
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', e => {
    if (!dragging) return;
    samples.push({ t: e.timeStamp, y: e.clientY });
    const dy = offset(e.clientY);
    sheet.style.transform = `translateY(${dy}px)`;
    scrim.style.opacity = String(scrimAt(dy));
  });
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const height = sheet.offsetHeight;
    const dy = offset(e.clientY);
    const recent = samples.filter(s => e.timeStamp - s.t <= 100);
    const first = recent[0] ?? samples[0];
    const dt = e.timeStamp - first.t;
    const velocity = dt > 0 ? (e.clientY - first.y) / dt : 0;
    const from = `translateY(${dy}px)`;
    const scrimFrom = scrimAt(dy);
    sheet.style.transform = '';
    scrim.style.opacity = '';
    if (dy > height * 0.3 || velocity > 0.5) {
      const duration = Math.min(260, Math.max(120, (height - dy) / Math.max(velocity, 1.2)));
      dismiss(from, duration, scrimFrom);
    } else {
      animate(sheet, [{ transform: from }, { transform: 'translateY(0)' }]);
      animate(scrim, [{ opacity: scrimFrom }, { opacity: SCRIM_OPACITY }]);
    }
  };
  head.addEventListener('pointerup', release);
  head.addEventListener('pointercancel', release);

  return handle;
}
