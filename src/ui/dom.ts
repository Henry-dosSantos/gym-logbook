import { createElement } from 'lucide';
import type { IconNode } from 'lucide';
import { pressable } from './press';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, action: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  b.dataset.action = action;
  b.addEventListener('click', onClick);
  pressable(b);
  return b;
}

export function icon(node: IconNode, size = 20): SVGElement {
  return createElement(node, { width: size, height: size, 'stroke-width': 1.5 }) as SVGElement;
}
