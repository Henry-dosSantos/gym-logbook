export function effectiveTopInset(envTop: number, screenHeight: number, innerHeight: number): number {
  return envTop > 0 && screenHeight - innerHeight >= envTop ? 0 : envTop;
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
    app.style.height = `${height}px`;
    app.style.transform = `translateY(${top}px)`;
    app.classList.toggle('kb-open', window.innerHeight - height > 120);
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
