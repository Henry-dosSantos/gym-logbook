import { ChevronRight, Plus } from 'lucide';
import { el, icon } from './dom';
import { pressable } from './press';

export const sectionLabel = (text: string, first = false): HTMLElement =>
  el('div', first ? 'section-label first' : 'section-label', text);

export const sectionFooter = (text = ''): HTMLElement => el('div', 'section-footer', text);

export function setRow(label: string, control: HTMLElement): HTMLElement {
  const row = el('div', 'set-row');
  row.append(el('span', 'set-label', label), control);
  return row;
}

export interface NavRow {
  el: HTMLButtonElement;
  setValue(text: string, bright?: boolean): void;
}

export function navRow(left: string | HTMLElement, onClick: () => void): NavRow {
  const row = el('button', 'row nav-row');
  row.type = 'button';
  const label = typeof left === 'string' ? el('span', 'nav-label', left) : left;
  const trail = el('span', 'nav-trail');
  const value = el('span', 'nav-value');
  trail.append(value, icon(ChevronRight, 18));
  row.append(label, trail);
  pressable(row);
  row.addEventListener('click', onClick);
  return {
    el: row,
    setValue(text, bright = false) {
      value.textContent = text;
      value.classList.toggle('bright', bright);
    },
  };
}

export function leadingRow(action: string, label: string, onClick: () => void): HTMLButtonElement {
  const row = el('button', 'row lead-row');
  row.type = 'button';
  row.dataset.action = action;
  row.append(icon(Plus), el('span', 'lead-label', label));
  pressable(row);
  row.addEventListener('click', onClick);
  return row;
}
