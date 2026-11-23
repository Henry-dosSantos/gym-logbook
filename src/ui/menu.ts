import { isolateHistory } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { Ellipsis } from 'lucide';
import { entryText } from '../core/history';
import { exportFiles } from '../export';
import { platform } from '../platform';
import { parsedField } from '../editor/state';
import { button, el, icon } from './dom';
import { pressable } from './press';
import { openSheet } from './sheet';
import type { SheetHandle } from './sheet';
import { dashboardView } from './dashboard';
import { settingsView } from './settings-view';
import type { AppContext } from './settings-view';

function importView(ctx: AppContext, sheet: () => SheetHandle): HTMLElement {
  const root = el('div', 'import');
  const area = el('textarea', 'field');
  area.dataset.field = 'import';
  area.placeholder = 'Paste log';
  area.setAttribute('autocorrect', 'off');
  area.setAttribute('autocapitalize', 'off');
  area.spellcheck = false;
  area.style.minHeight = '40vh';
  const actions = el('div', 'import-actions');
  root.append(area, actions);

  const showReplace = () => {
    actions.replaceChildren(
      button('btn btn-accept btn-wide', 'replace', 'Replace', () => {
        if (area.value !== '') showConfirm();
      }),
    );
  };
  const showConfirm = () => {
    const row = el('div', 'confirm-row');
    row.append(
      button('btn', 'cancel', 'Cancel', showReplace),
      button('btn btn-accept', 'confirm', 'Replace', () => {
        const view = ctx.view;
        const insert = area.value;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert },
          selection: { anchor: insert.length },
          scrollIntoView: true,
          annotations: isolateHistory.of('full'),
          userEvent: 'input.paste',
        });
        ctx.flushText();
        sheet().close();
      }),
    );
    actions.replaceChildren(el('div', 'confirm-text', 'Replace the whole log?'), row);
  };
  showReplace();
  return root;
}

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
  const sub = (label: string, build: () => HTMLElement) => sheet.setContent(label, build());

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
  row('copy-entry', 'Copy entry', () => {
    const text = entryText(view.state.field(parsedField), view.state.selection.main.head);
    if (text !== null) platform.copy(text);
    sheet.close();
  });
  row('export', 'Export', () => {
    const text = view.state.doc.toString();
    sheet.close();
    void platform.share(exportFiles(text, ctx.getSettings(), new Date()));
  });
  row('import', 'Import', () => sub('Import', () => importView(ctx, get)));
  row('lint', 'Lint', () => sub('Lint', () => lintView(ctx, get)), flagCount ? String(flagCount) : undefined);
  row('settings', 'Settings', () => sub('Settings', () => settingsView(ctx)));

  sheet = openSheet({ label: 'Menu', content, onClose: ctx.flushSettings });
}
