export interface SheetHandle {
  close(): void;
  setContent(label: string, content: HTMLElement): void;
}

const DURATION = 220;
const EASING = 'cubic-bezier(0.2,0.8,0.2,1)';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const animate = (el: HTMLElement, frames: Keyframe[], fill: FillMode = 'none') =>
    reduced() ? null : el.animate(frames, { duration: DURATION, easing: EASING, fill });

  animate(sheet, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]);
  animate(scrim, [{ opacity: 0 }, { opacity: 0.6 }]);

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

  const dismiss = (from: string) => {
    if (closed) return;
    closed = true;
    const a = animate(sheet, [{ transform: from }, { transform: 'translateY(100%)' }], 'forwards');
    const b = animate(scrim, [{ opacity: 0.6 }, { opacity: 0 }], 'forwards');
    if (a && b) a.finished.then(finish, finish);
    else finish();
  };

  const handle: SheetHandle = {
    close: () => dismiss('translateY(0)'),
    setContent(label, content) {
      sheet.setAttribute('aria-label', label);
      title.textContent = label;
      body.replaceChildren(content);
    },
  };
  current = handle;

  scrim.addEventListener('click', () => handle.close());

  let startY = 0;
  let dragging = false;
  let samples: { t: number; y: number }[] = [];
  const offset = (y: number) => Math.max(0, y - startY);
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
    sheet.style.transform = `translateY(${offset(e.clientY)}px)`;
  });
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const dy = offset(e.clientY);
    const recent = samples.filter(s => e.timeStamp - s.t <= 100);
    const first = recent[0] ?? samples[0];
    const dt = e.timeStamp - first.t;
    const velocity = dt > 0 ? (e.clientY - first.y) / dt : 0;
    const from = `translateY(${dy}px)`;
    if (dy > sheet.offsetHeight * 0.3 || velocity > 0.5) {
      sheet.style.transform = '';
      dismiss(from);
    } else {
      sheet.style.transform = '';
      animate(sheet, [{ transform: from }, { transform: 'translateY(0)' }]);
    }
  };
  head.addEventListener('pointerup', release);
  head.addEventListener('pointercancel', release);

  return handle;
}
