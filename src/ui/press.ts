export function pressable(el: HTMLElement): void {
  const on = () => el.classList.add('is-pressed');
  const off = () => el.classList.remove('is-pressed');
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
}
