import { isolateHistory } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { ArrowRight } from 'lucide';
import { suggestFix } from '../core/fix';
import { parsedField } from '../editor/state';
import { button, el, icon } from './dom';
import { pressable } from './press';
import { closeSheet, reduced } from './sheet';
import { createStack, pageHeader } from './stack';
import type { Page, Stack } from './stack';
import type { AppContext } from './settings-view';

function rootPage(ctx: AppContext, stack: () => Stack): Page {
  const root = el('div', 'lint');

  const build = () => {
    root.replaceChildren();
    const doc = ctx.view.state.field(parsedField);
    if (!doc.flags.length) {
      root.append(el('div', 'empty', 'No flags'));
      return;
    }
    for (const flag of doc.flags) {
      const line = doc.lines[flag.line - 1];
      const row = el('button', 'row lint-row');
      row.type = 'button';
      row.dataset.line = String(flag.line);
      const top = el('div', 'lint-top');
      top.append(el('span', 'lint-num', String(flag.line)), el('span', 'lint-msg', flag.message));
      row.append(top, el('div', 'lint-text', line.text));
      const fix = suggestFix(doc, line, ctx.getSettings().aliases);
      if (fix !== null) {
        const fixLine = el('div', 'lint-fix');
        fixLine.append(icon(ArrowRight, 14), el('span', 'lint-fix-text', fix));
        row.append(fixLine);
      }
      pressable(row);
      row.addEventListener('click', () => stack().push(fixPage(ctx, stack, flag.line)));
      root.append(row);
    }
  };
  build();
  return { el: root, refresh: build };
}

function fixPage(ctx: AppContext, stack: () => Stack, firstLine: number): Page {
  const root = el('div', 'fix');
  let n = firstLine;
  const header = pageHeader('', () => stack().pop());
  const title = header.querySelector('.page-title') as HTMLElement;
  const body = el('div', 'fix-body');
  const message = el('div', 'fix-message');
  const now = el('div', 'fix-now');
  const input = el('input', 'fix-input');
  input.type = 'text';
  input.dataset.field = 'fix';
  input.setAttribute('enterkeyhint', 'done');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.spellcheck = false;

  const focusEnd = () => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  const show = (line: number, fade: boolean) => {
    n = line;
    const doc = ctx.view.state.field(parsedField);
    const flag = doc.flags.find(f => f.line === line);
    const text = doc.lines[line - 1].text;
    title.textContent = `Line ${line}`;
    message.textContent = flag?.message ?? '';
    now.textContent = text;
    input.value = suggestFix(doc, doc.lines[line - 1], ctx.getSettings().aliases) ?? text;
    if (fade && !reduced()) body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear' });
  };

  const apply = () => {
    const view = ctx.view;
    const line = view.state.doc.line(n);
    if (input.value !== line.text) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: input.value },
        userEvent: 'input',
        annotations: isolateHistory.of('full'),
      });
      ctx.flushText();
    }
    const flags = view.state.field(parsedField).flags;
    const next = flags.find(f => f.line > n) ?? flags[0];
    if (!next) {
      stack().pop();
      return;
    }
    show(next.line, true);
    focusEnd();
  };

  const showInLog = () => {
    const view = ctx.view;
    const pos = view.state.doc.line(n).to;
    closeSheet();
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    view.focus();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
    }
  });

  const actions = el('div', 'fix-actions');
  actions.append(
    button('btn', 'show', 'Show in log', showInLog),
    button('btn btn-accept', 'apply', 'Fix', apply),
  );

  body.append(message, el('div', 'fix-label', 'Now'), now, el('div', 'fix-label', 'Change to'), input, actions);
  root.append(header, body);
  show(firstLine, false);
  return { el: root, mounted: focusEnd };
}

export function lintView(ctx: AppContext): HTMLElement {
  let stack!: Stack;
  stack = createStack(rootPage(ctx, () => stack));
  return stack.el;
}
