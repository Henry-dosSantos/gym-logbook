import type { StripItem } from '../core/types';

export interface Strip {
  el: HTMLElement;
  setStrip(items: StripItem[]): void;
}

export function createStrip(): Strip {
  const el = document.createElement('div');
  el.className = 'bar';
  const strip = document.createElement('div');
  strip.className = 'strip';
  el.append(strip);

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
    },
  };
}
