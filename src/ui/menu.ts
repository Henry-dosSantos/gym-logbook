import { isolateHistory } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { Ellipsis } from 'lucide';
import { todayText } from '../core/history';
import { platform } from '../platform';
import { parsedField } from '../editor/state';
import { button, el, icon } from './dom';
import { pressable } from './press';
import { openSheet } from './sheet';
import type { SheetHandle } from './sheet';
import { dashboardView } from './dashboard';
import { settingsView } from './settings-view';
import type { AppContext } from './settings-view';

function lintView(ctx: AppContext, sheet: () => SheetHandle): HTMLElement {
  const root = el('div', 'lint');
  const doc = ctx.view.state.field(parsedField);
  if (!doc.flags.length) {
    root.append(el('div', 'empty', 'No flags'));
    return root;
  }
  for (const flag of doc.flags) {
    const row = el('button', 'row lint-row');
    row.type = 'button';
    row.dataset.line = String(flag.line);
    const top = el('div', 'lint-top');
    top.append(el('span', 'lint-num', String(flag.line)), el('span', 'lint-msg', flag.message));
    row.append(top, el('div', 'lint-text', doc.lines[flag.line - 1].text));
    pressable(row);
    row.addEventListener('click', () => {
      const view = ctx.view;
      const pos = view.state.doc.line(flag.line).to;
      sheet().close();
      view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
      view.focus();
    });
    root.append(row);
  }
  return root;
}

export function createMenuButton(ctx: AppContext): HTMLButtonElement {
  const b = el('button', 'menu-btn');
  b.type = 'button';
  b.dataset.action = 'menu';
  b.setAttribute('aria-label', 'Menu');
  b.append(icon(Ellipsis));
  pressable(b);
  b.addEventListener('click', () => openMenu(ctx));
  return b;
}

function openMenu(ctx: AppContext): void {
  const view = ctx.view;
  const flagCount = view.state.field(parsedField).flags.length;
  const content = el('div', 'menu');
  let sheet!: SheetHandle;
  const get = () => sheet;

  const row = (action: string, label: string, onClick: () => void, meta?: string) => {
    const b = button('row', action, label, onClick);
    if (meta) b.append(el('span', 'row-meta', meta));
    content.append(b);
  };

  row('dashboard', 'Dashboard', () =>
    sheet.setContent('Dashboard', dashboardView(view.state.field(parsedField), ctx.getSettings().aliases), {
      full: true,
      flush: true,
    }),
  );
  row('copy-all', 'Copy all', () => {
    platform.copy(view.state.doc.toString());
    ctx.flushText();
    sheet.close();
  });
  row('copy-today', "Copy today's workout", () => {
    const text = todayText(view.state.field(parsedField), new Date());
    if (text !== null) platform.copy(text);
    sheet.close();
  });
  row('paste', 'Paste', () => {
    void platform.paste().then(text => {
      if (text) {
        const at = view.state.selection.main;
        const insert = view.state.toText(text);
        view.dispatch({
          changes: { from: at.from, to: at.to, insert },
          selection: { anchor: at.from + insert.length },
          scrollIntoView: true,
          userEvent: 'input.paste',
          annotations: isolateHistory.of('full'),
        });
        ctx.flushText();
      }
      sheet.close();
    });
  });
  row('lint', 'Lint', () => sheet.setContent('Lint', lintView(ctx, get)), flagCount ? String(flagCount) : undefined);
  row('settings', 'Settings', () => sheet.setContent('Settings', settingsView(ctx), { full: true, flush: true }));

  sheet = openSheet({ label: 'Menu', content, onClose: ctx.flushSettings });
}
