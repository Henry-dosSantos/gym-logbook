import { isolateHistory } from '@codemirror/commands';
import { Check, ChartLine, ClipboardCopy, ClipboardPaste, Copy, ListChecks, Settings as SettingsIcon } from 'lucide';
import type { IconNode } from 'lucide';
import { todayText } from '../core/history';
import { parsedField } from '../editor/state';
import { platform } from '../platform';
import { dashboardView } from './dashboard';
import { el, icon } from './dom';
import { lintPanel } from './lint-view';
import { pressable } from './press';
import { settingsView } from './settings-view';
import type { AppContext } from './settings-view';
import { openSheet } from './sheet';

export interface Bar {
  el: HTMLElement;
  setFlagCount(count: number): void;
}

interface TabDef {
  action: string;
  icon: IconNode;
  label: string;
  aria: string;
}

const TABS: TabDef[] = [
  { action: 'dashboard', icon: ChartLine, label: 'Dashboard', aria: 'Dashboard' },
  { action: 'copy-today', icon: ClipboardCopy, label: 'Copy day', aria: "Copy today's workout" },
  { action: 'copy-all', icon: Copy, label: 'Copy all', aria: 'Copy all' },
  { action: 'paste', icon: ClipboardPaste, label: 'Paste', aria: 'Paste' },
  { action: 'lint', icon: ListChecks, label: 'Lint', aria: 'Lint' },
  { action: 'settings', icon: SettingsIcon, label: 'Settings', aria: 'Settings' },
];

const DONE_MS = 1200;

export function createBar(ctx: AppContext): Bar {
  const nav = el('nav', 'tabbar glass');
  const tabs = new Map<string, HTMLButtonElement>();
  let badge!: HTMLElement;

  const done = (tab: HTMLButtonElement) => {
    tab.classList.add('is-done');
    platform.haptic();
    window.setTimeout(() => tab.classList.remove('is-done'), DONE_MS);
  };

  const sheet = (label: string, content: HTMLElement) =>
    openSheet({ label, content, flush: true, onClose: ctx.flushSettings });

  const handlers: Record<string, (tab: HTMLButtonElement) => void> = {
    dashboard: () =>
      sheet('Dashboard', dashboardView(ctx.view.state.field(parsedField), ctx.getSettings().aliases)),
    lint: () => {
      const panel = lintPanel(ctx);
      openSheet({
        label: 'Lint',
        content: panel.el,
        panel: true,
        onClose: () => {
          panel.cleanup();
          ctx.flushSettings();
        },
      });
      panel.start();
    },
    settings: () => sheet('Settings', settingsView(ctx)),
    'copy-today': tab => {
      const text = todayText(ctx.view.state.field(parsedField), new Date());
      if (text === null) return;
      platform.copy(text);
      done(tab);
    },
    'copy-all': tab => {
      platform.copy(ctx.view.state.doc.toString());
      ctx.flushText();
      done(tab);
    },
    paste: tab => {
      void platform.paste().then(text => {
        if (!text) return;
        const view = ctx.view;
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
        done(tab);
      });
    },
  };

  for (const def of TABS) {
    const tab = el('button', 'tab');
    tab.type = 'button';
    tab.dataset.action = def.action;
    tab.setAttribute('aria-label', def.aria);
    const inner = el('span', 'tab-inner');
    const iconWrap = el('span', 'tab-icon');
    const main = icon(def.icon, 22);
    main.classList.add('tab-glyph');
    const check = icon(Check, 22);
    check.classList.add('tab-check');
    iconWrap.append(main, check);
    if (def.action === 'lint') {
      badge = el('span', 'tab-badge');
      badge.hidden = true;
      iconWrap.append(badge);
    }
    inner.append(iconWrap, el('span', 'tab-label', def.label));
    tab.append(inner);
    pressable(tab);
    tab.addEventListener('click', () => handlers[def.action](tab));
    tabs.set(def.action, tab);
    nav.append(tab);
  }

  return {
    el: nav,
    setFlagCount(count) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    },
  };
}
