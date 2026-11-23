export function effectiveTopInset(envTop: number, screenHeight: number, innerHeight: number): number {
  return envTop > 0 && screenHeight - innerHeight >= envTop ? 0 : envTop;
}

/**
 * The app's height. With the keyboard up it is the visible area above it. Otherwise it is at least the window,
 * and in a Home Screen app that spans the screen's width it is the whole screen, so nothing is left black under
 * the home indicator when iOS reports a shorter visible area. Split View (narrower than the screen) is left alone.
 */
export function appHeight(v: {
  visual: number;
  inner: number;
  innerWidth: number;
  screenWidth: number;
  screenHeight: number;
  standalone: boolean;
  keyboard: boolean;
}): number {
  if (v.keyboard) return v.visual;
  let h = Math.max(v.visual, v.inner);
  if (v.standalone) {
    const long = Math.max(v.screenWidth, v.screenHeight);
    const short = Math.min(v.screenWidth, v.screenHeight);
    const [across, down] = v.innerWidth > h ? [long, short] : [short, long];
    if (Math.abs(v.innerWidth - across) <= 1) h = Math.max(h, down);
  }
  return h;
}

let currentTop = 0;

/** Height of the status bar / Dynamic Island area the editor text scrolls behind. */
export function topInset(): number {
  return currentTop;
}

/**
 * Sizes the app to the visible area above the keyboard. iOS pans the whole page up when the
 * keyboard opens; that pan is undone at once (the log scrolls inside the editor instead), and
 * onResize runs whenever the visible height changes so the caret can be brought into view.
 */
export function trackViewport(app: HTMLElement, onResize?: () => void): void {
  const vv = window.visualViewport;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
  document.body.append(probe);

  let lastHeight = -1;
  const update = () => {
    if (window.scrollY !== 0 || (vv && vv.offsetTop !== 0)) window.scrollTo(0, 0);
    const height = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    const keyboard = window.innerHeight - height > 120;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const full = appHeight({
      visual: height,
      inner: window.innerHeight,
      innerWidth: window.innerWidth,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      standalone,
      keyboard,
    });
    app.style.height = `${full}px`;
    app.style.transform = `translateY(${top}px)`;
    app.classList.toggle('kb-open', keyboard);
    if (keyboard) app.classList.remove('kb-pending');
    const inset = effectiveTopInset(probe.offsetHeight, window.screen.height, window.innerHeight);
    currentTop = inset;
    document.documentElement.style.setProperty('--top', `${inset}px`);
    if (height !== lastHeight) {
      const first = lastHeight < 0;
      lastHeight = height;
      if (!first) onResize?.();
    }
  };
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('scroll', update, { passive: true });
  document.addEventListener('focusin', () => requestAnimationFrame(update));
  update();
}

const PENDING_MS = 1000;
const TAP_MOVE = 8;

/**
 * A tap in the log brings up the keyboard a moment later. Hide the bar right away (kb-pending) instead of waiting
 * for the screen to shrink, so it never rides up with it; if no keyboard comes, the bar returns.
 */
export function hideBarBeforeKeyboard(app: HTMLElement, host: HTMLElement): void {
  let start: { x: number; y: number; id: number } | null = null;
  let timer: number | undefined;
  host.addEventListener('pointerdown', e => {
    start = e.isPrimary ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  }, { passive: true });
  host.addEventListener('pointerup', e => {
    const s = start;
    start = null;
    if (!s || s.id !== e.pointerId || app.classList.contains('kb-open')) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) >= TAP_MOVE) return;
    app.classList.add('kb-pending');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => app.classList.remove('kb-pending'), PENDING_MS);
  }, { passive: true });
}
