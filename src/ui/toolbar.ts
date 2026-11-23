import { CornerDownLeft, createElement } from 'lucide';
import type { EditorView } from '@codemirror/view';
import type { StripItem } from '../core/types';
import { acceptGhost, insertNewline } from '../editor/ghost';
import { pressable } from './press';

export interface Toolbar {
  el: HTMLElement;
  setStrip(items: StripItem[]): void;
}

function typeChar(view: EditorView, ch: string): void {
  view.dispatch({ ...view.state.replaceSelection(ch), scrollIntoView: true, userEvent: 'input.type' });
}

export function createToolbar(getView: () => EditorView): Toolbar {
  const el = document.createElement('div');
  el.className = 'bar';

  const strip = document.createElement('div');
  strip.className = 'strip';
  el.append(strip);

  const row = document.createElement('div');
  row.className = 'bar-row';
  el.append(row);

  const add = (action: string, run: (view: EditorView) => void, label?: string, icon?: SVGElement) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = action === 'accept' ? 'btn btn-accept' : 'btn';
    b.dataset.action = action;
    if (label) b.textContent = label;
    if (icon) {
      b.append(icon);
      b.setAttribute('aria-label', 'New line');
    }
    const keepFocus = (e: Event) => e.preventDefault();
    b.addEventListener('pointerdown', keepFocus);
    b.addEventListener('mousedown', keepFocus);
    b.addEventListener('click', () => {
      const view = getView();
      run(view);
      view.focus();
    });
    pressable(b);
    row.append(b);
  };

  const icon = createElement(CornerDownLeft, { width: 20, height: 20, 'stroke-width': 1.5 }) as SVGElement;
  add('dash', v => typeChar(v, '-'), '-');
  add('slash', v => typeChar(v, '/'), '/');
  add('accept', v => void acceptGhost(v), 'Accept');
  add('newline', v => void insertNewline(v), undefined, icon);

  return {
    el,
    setStrip(items) {
      strip.replaceChildren();
      items.forEach(item => {
        const item_ = document.createElement('span');
        item_.className = 'strip-item';
        const date = document.createElement('span');
        date.className = 'strip-date';
        date.textContent = item.date;
        const sets = document.createElement('span');
        sets.className = 'strip-sets';
        sets.textContent = item.sets;
        item_.append(date, ' ', sets);
        strip.append(item_);
      });
    },
  };
}
