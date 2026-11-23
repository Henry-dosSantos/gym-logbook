export function trackViewport(app: HTMLElement): void {
  const vv = window.visualViewport;
  const update = () => {
    const height = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    app.style.height = `${height}px`;
    app.style.transform = `translateY(${top}px)`;
    app.classList.toggle('kb-open', window.innerHeight - height > 120);
  };
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
}
