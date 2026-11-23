export function effectiveTopInset(envTop: number, screenHeight: number, innerHeight: number): number {
  return envTop > 0 && screenHeight - innerHeight >= envTop ? 0 : envTop;
}

export function trackViewport(app: HTMLElement): void {
  const vv = window.visualViewport;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none';
  document.body.append(probe);

  const update = () => {
    const height = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    app.style.height = `${height}px`;
    app.style.transform = `translateY(${top}px)`;
    app.classList.toggle('kb-open', window.innerHeight - height > 120);
    const inset = effectiveTopInset(probe.offsetHeight, window.screen.height, window.innerHeight);
    document.documentElement.style.setProperty('--top', `${inset}px`);
  };
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
}
