import type { StripItem } from '../core/types';

export interface Strip {
  el: HTMLElement;
  setStrip(items: StripItem[]): void;
  setActive(active: boolean): void;
}

export function createStrip(onShow?: () => void): Strip {
  const el = document.createElement('div');
  el.className = 'strip-bar';
  el.hidden = true;
  const strip = document.createElement('div');
  strip.className = 'strip';
  el.append(strip);

  let count = 0;
  let active = false;
  const sync = () => {
    const wasHidden = el.hidden;
    el.hidden = !(count > 0 && active);
    if (wasHidden && !el.hidden) onShow?.();
  };

  return {
    el,
    setStrip(items) {
      strip.replaceChildren();
      for (const item of items) {
        const node = document.createElement('span');
        node.className = 'strip-item';
        const date = document.createElement('span');
        date.className = 'strip-date';
        date.textContent = item.date;
        const sets = document.createElement('span');
        sets.className = 'strip-sets';
        sets.textContent = item.sets;
        node.append(date, ' ', sets);
        strip.append(node);
      }
      count = items.length;
      sync();
    },
    setActive(value) {
      active = value;
      sync();
    },
  };
}
