import { Minus, Plus } from 'lucide';
import { platform } from '../platform';
import { el, icon } from './dom';
import { pressable } from './press';
import { EASE_IOS, reduced } from './sheet';

export interface Stepper {
  el: HTMLElement;
  set(value: number): void;
}

export function stepper(opts: {
  value: number;
  min: number;
  max: number;
  step: number;
  format(v: number): string;
  onChange(v: number): void;
}): Stepper {
  let value = opts.value;
  const field = el('div', 'stepper-field');
  const valueEl = el('span', 'stepper-value');
  const box = el('div', 'stepper');

  const make = (dir: 'down' | 'up', label: string, svg: SVGElement) => {
    const b = el('button', 'stepper-btn');
    b.type = 'button';
    b.dataset.step = dir;
    b.setAttribute('aria-label', label);
    b.append(svg);
    pressable(b);
    return b;
  };
  const down = make('down', 'Decrease', icon(Minus, 18));
  const up = make('up', 'Increase', icon(Plus, 18));
  box.append(down, up);
  field.append(valueEl, box);

  const render = () => {
    valueEl.textContent = opts.format(value);
    down.disabled = value <= opts.min;
    up.disabled = value >= opts.max;
  };

  const change = (dir: 1 | -1) => {
    const next = Math.round(Math.min(opts.max, Math.max(opts.min, value + dir * opts.step)) * 100) / 100;
    if (next === value) return;
    value = next;
    render();
    platform.haptic();
    opts.onChange(value);
    if (!reduced()) {
      valueEl.animate(
        [{ transform: `translateY(${dir * 6}px)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 160, easing: EASE_IOS },
      );
    }
  };
  down.addEventListener('click', () => change(-1));
  up.addEventListener('click', () => change(1));
  render();

  return {
    el: field,
    set(v) {
      value = v;
      render();
    },
  };
}
