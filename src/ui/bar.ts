import { isolateHistory } from '@codemirror/commands';
import { Check, ChartLine, ClipboardCopy, ClipboardPaste, Copy, ListChecks, Settings as SettingsIcon } from 'lucide';
import type { IconNode } from 'lucide';
import { todayText } from '../core/history';
import { parsedField } from '../editor/state';
import { platform } from '../platform';
import { dashboardView } from './dashboard';
import { el, icon } from './dom';
import { lintPanel } from './lint-view';
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
const SLIDE_SLOP = 64;
const CLICK_SWALLOW_MS = 600;

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
    // Taps and slides are handled on the bar below; click stays for keyboard activation.
    tab.addEventListener('click', () => {
      if (!suppressClick) handlers[def.action](tab);
    });
    tabs.set(def.action, tab);
    nav.append(tab);
  }

  // Hold anywhere on the bar and slide: the pill follows the finger from tab to tab and letting go opens the
  // tab under it, so a wrong tap can be corrected before it lands. Sliding well off the bar cancels.
  const pill = el('div', 'tab-pill');
  nav.prepend(pill);
  let pointer = -1;
  let current: HTMLButtonElement | null = null;
  let suppressClick = false;
  let swallowUntil = 0;

  const tabAt = (x: number, y: number): HTMLButtonElement | null => {
    const r = nav.getBoundingClientRect();
    if (y < r.top - SLIDE_SLOP || y > r.bottom + SLIDE_SLOP) return null;
    const list = [...tabs.values()];
    if (x < r.left) return list[0];
    if (x >= r.right) return list[list.length - 1];
    return list.find(t => {
      const b = t.getBoundingClientRect();
      return x >= b.left && x < b.right;
    }) ?? null;
  };

  const highlight = (tab: HTMLButtonElement | null) => {
    const was = current;
    if (was === tab) return;
    was?.classList.remove('is-pressed');
    current = tab;
    if (!tab) {
      pill.classList.remove('is-on');
      return;
    }
    tab.classList.add('is-pressed');
    const move = `translateX(${tab.offsetLeft}px)`;
    pill.style.width = `${tab.offsetWidth}px`;
    if (!was) {
      // Appear in place, then glide between tabs.
      pill.style.transition = 'none';
      pill.style.transform = move;
      void pill.offsetWidth;
      pill.style.transition = '';
      pill.classList.add('is-on');
    } else {
      pill.style.transform = move;
      platform.haptic();
    }
  };

  nav.addEventListener('pointerdown', e => {
    const tab = (e.target as Element).closest<HTMLButtonElement>('.tab');
    if (!tab || !e.isPrimary) return;
    pointer = e.pointerId;
    nav.setPointerCapture(e.pointerId);
    highlight(tab);
  });
  nav.addEventListener('pointermove', e => {
    if (e.pointerId === pointer) highlight(tabAt(e.clientX, e.clientY));
  });
  nav.addEventListener('pointerup', e => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    const tab = current;
    highlight(null);
    if (!tab) return;
    // The browser's own click for this touch comes after pointerup and would land on whatever just opened
    // (a sheet's scrim closes the sheet). Swallow that one click.
    suppressClick = true;
    swallowUntil = performance.now() + CLICK_SWALLOW_MS;
    handlers[tab.dataset.action!](tab);
  });
  document.addEventListener(
    'click',
    e => {
      if (!suppressClick) return;
      suppressClick = false;
      if (performance.now() > swallowUntil) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  nav.addEventListener('pointercancel', e => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    highlight(null);
  });

  return {
    el: nav,
    setFlagCount(count) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    },
  };
}
