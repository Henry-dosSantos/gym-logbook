import { isolateHistory } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { ArrowRight, ChevronDown, ChevronUp, X } from 'lucide';
import type { IconNode } from 'lucide';
import { suggestFix } from '../core/fix';
import { clearFocusLine, focusLine } from '../editor/focus-line';
import { parsedField } from '../editor/state';
import { button, el, icon } from './dom';
import { pressable } from './press';
import { closeSheet, reduced } from './sheet';
import type { AppContext } from './settings-view';

export interface LintPanel {
  el: HTMLElement;
  /** Call once the panel is on screen: shows the first flag in the log. */
  start(): void;
  cleanup(): void;
}

function iconButton(action: string, label: string, glyph: IconNode, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'icon-btn');
  b.type = 'button';
  b.dataset.action = action;
  b.setAttribute('aria-label', label);
  b.append(icon(glyph, 20));
  pressable(b);
  b.addEventListener('click', onClick);
  return b;
}

export function lintPanel(ctx: AppContext): LintPanel {
  const view = ctx.view;
  const root = el('div', 'lint');
  let current = 0;
  let open = true;

  const flags = () => view.state.field(parsedField).flags;
  const fixFor = (n: number) => {
    const doc = view.state.field(parsedField);
    return suggestFix(doc, doc.lines[n - 1], ctx.getSettings().aliases);
  };

  const count = el('span', 'lint-count');
  const head = el('div', 'lint-head');
  head.append(count, iconButton('close', 'Close', X, () => closeSheet()));

  const card = el('div', 'lint-card');
  const top = el('div', 'lint-top');
  const num = el('span', 'lint-num');
  const msg = el('span', 'lint-msg');
  top.append(num, msg);
  const now = el('div', 'lint-text');
  const fixLine = el('div', 'lint-fix');
  const fixText = el('span', 'lint-fix-text');
  fixLine.append(icon(ArrowRight, 14), fixText);
  card.append(top, now, fixLine);

  const apply = button('btn btn-accept', 'apply', 'Fix', () => applyFix());
  const actions = el('div', 'lint-actions');
  actions.append(
    iconButton('prev', 'Previous', ChevronUp, () => step(-1)),
    iconButton('next', 'Next', ChevronDown, () => step(1)),
    button('btn', 'edit', 'Edit', () => edit()),
    apply,
  );

  const list = el('div', 'lint-list');
  const empty = el('div', 'empty', 'No flags');

  const render = (fade = false) => {
    const all = flags();
    if (!all.length) {
      clearFocusLine(view);
      root.replaceChildren(head, empty);
      count.textContent = '';
      return;
    }
    current = Math.min(current, all.length - 1);
    const flag = all[current];
    const doc = view.state.field(parsedField);
    count.textContent = `${current + 1} of ${all.length}`;
    num.textContent = `Line ${flag.line}`;
    msg.textContent = flag.message;
    now.textContent = doc.lines[flag.line - 1].text;
    const fix = fixFor(flag.line);
    fixLine.hidden = fix === null;
    fixText.textContent = fix ?? '';
    apply.disabled = fix === null;
    card.dataset.line = String(flag.line);

    const rows = all.map((f, i) => {
      const row = el('button', 'row lint-row');
      row.type = 'button';
      row.dataset.line = String(f.line);
      if (i === current) row.setAttribute('aria-current', 'true');
      const rowTop = el('div', 'lint-top');
      rowTop.append(el('span', 'lint-num', String(f.line)), el('span', 'lint-msg', f.message));
      row.append(rowTop, el('div', 'lint-text', doc.lines[f.line - 1].text));
      pressable(row);
      row.addEventListener('click', () => select(i));
      return row;
    });
    list.replaceChildren(...rows);
    if (root.firstChild !== head || root.childElementCount !== 5)
      root.replaceChildren(head, card, actions, el('div', 'section-label', 'All flags'), list);
    focusLine(view, flag.line);
    if (fade && !reduced()) card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
  };

  const select = (i: number) => {
    current = i;
    render(true);
    root.closest('.sheet-body')?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  };

  const step = (d: number) => {
    const n = flags().length;
    if (n) select((current + d + n) % n);
  };

  const applyFix = () => {
    const all = flags();
    const flag = all[current];
    if (!flag) return;
    const fix = fixFor(flag.line);
    if (fix === null) return;
    const line = view.state.doc.line(flag.line);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: fix },
      userEvent: 'input',
      annotations: isolateHistory.of('full'),
    });
    ctx.flushText();
    const after = flags();
    const next = after.findIndex(f => f.line > flag.line);
    current = next >= 0 ? next : 0;
    render(true);
  };

  const edit = () => {
    const flag = flags()[current];
    closeSheet();
    if (!flag) return;
    const pos = view.state.doc.line(flag.line).to;
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    view.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (view.hasFocus || e.defaultPrevented) return;
    if (e.key === 'Enter') applyFix();
    else if (e.key === 'ArrowDown') step(1);
    else if (e.key === 'ArrowUp') step(-1);
    else return;
    e.preventDefault();
  };
  // Typing in the log means editing it: get out of the way.
  const onEditorFocus = () => closeSheet();

  return {
    el: root,
    start() {
      render();
      // The log gains bottom room for the panel; jump again once that has been laid out.
      requestAnimationFrame(() => {
        const flag = flags()[current];
        if (open && flag) focusLine(view, flag.line);
      });
      document.addEventListener('keydown', onKey);
      view.contentDOM.addEventListener('focus', onEditorFocus);
    },
    cleanup() {
      open = false;
      document.removeEventListener('keydown', onKey);
      view.contentDOM.removeEventListener('focus', onEditorFocus);
      clearFocusLine(view);
    },
  };
}
