import type { EditorView } from '@codemirror/view';
import { X } from 'lucide';
import { normName, spellingIndex } from '../core/history';
import {
  clearExerciseRule,
  exerciseRule,
  globalRule,
  setAliasGroups,
  setExerciseRule,
  setGlobal,
} from '../core/settings';
import { exerciseList } from '../core/suggest';
import type { Settings } from '../core/types';
import { parsedField } from '../editor/state';
import { button, el, icon } from './dom';
import { pressable } from './press';
import { leadingRow, navRow, sectionFooter, sectionLabel, setRow } from './rows';
import type { NavRow } from './rows';
import { createStack, pageHeader } from './stack';
import type { Page, Stack } from './stack';
import { stepper } from './stepper';
import type { Stepper } from './stepper';

export interface AppContext {
  view: EditorView;
  getSettings(): Settings;
  updateSettings(next: Settings): void;
  flushText(): void;
  flushSettings(): void;
}

const TARGET = { min: 1, max: 20, step: 1, format: (v: number) => String(v) };
const INCREMENT = { min: 2.5, max: 50, step: 2.5, format: (v: number) => `${v} lb` };

function customText(ctx: AppContext, key: string): string {
  const rule = ctx.getSettings().exercises[key];
  const parts: string[] = [];
  if (rule?.target !== undefined) parts.push(`${rule.target} reps`);
  if (rule?.increment !== undefined) parts.push(`+${rule.increment} lb`);
  return parts.join(', ');
}

function rootPage(ctx: AppContext, stack: () => Stack): Page {
  const root = el('div', 'settings');
  const rule = globalRule(ctx.getSettings());

  const footer = sectionFooter();
  footer.dataset.footer = 'progression';
  const renderFooter = () => {
    const r = globalRule(ctx.getSettings());
    footer.textContent = `When set 1 hits ${r.target} reps or more at the same weight two sessions in a row, the next suggestion goes up ${r.increment} lb.`;
  };

  const target = stepper({
    value: rule.target,
    ...TARGET,
    onChange: v => {
      ctx.updateSettings(setGlobal(ctx.getSettings(), 'target', v));
      renderFooter();
    },
  });
  target.el.dataset.setting = 'target';
  const increment = stepper({
    value: rule.increment,
    ...INCREMENT,
    onChange: v => {
      ctx.updateSettings(setGlobal(ctx.getSettings(), 'increment', v));
      renderFooter();
    },
  });
  increment.el.dataset.setting = 'increment';

  const exercises = navRow('Custom rules', () => stack().push(customRulesPage(ctx, stack)));
  exercises.el.dataset.action = 'exercises';
  const names = navRow('Merged names', () => stack().push(namesPage(ctx, stack)));
  names.el.dataset.action = 'names';

  const refresh = () => {
    const r = globalRule(ctx.getSettings());
    target.set(r.target);
    increment.set(r.increment);
    renderFooter();
    const custom = Object.keys(ctx.getSettings().exercises).length;
    exercises.setValue(custom ? String(custom) : '');
    const groups = ctx.getSettings().aliases.length;
    names.setValue(groups ? String(groups) : '');
  };

  root.append(
    sectionLabel('Progression', true),
    setRow('Reps to hit', target.el),
    setRow('Add', increment.el),
    footer,
    sectionLabel('Exercises'),
    exercises.el,
    sectionFooter('Give one exercise its own reps or step.'),
    sectionLabel('Names'),
    names.el,
    sectionFooter('Spellings that count as one exercise, like Bench and Flat bench.'),
  );
  refresh();
  return { el: root, refresh };
}

function customRulesPage(ctx: AppContext, stack: () => Stack): Page {
  const root = el('div', 'settings');
  const list = el('div', 'rule-list');
  let rows: { key: string; row: NavRow }[] = [];

  const build = () => {
    const doc = ctx.view.state.field(parsedField);
    rows = [];
    list.replaceChildren();
    for (const item of exerciseList(doc, ctx.getSettings().aliases)) {
      const row = navRow(item.name, () => stack().push(exercisePage(ctx, stack, item.key, item.name)));
      row.el.dataset.key = item.key;
      rows.push({ key: item.key, row });
      list.append(row.el);
    }
  };
  const refresh = () => {
    for (const { key, row } of rows) {
      const text = customText(ctx, key);
      row.setValue(text, true);
    }
  };

  build();
  refresh();
  root.append(
    pageHeader('Custom rules', () => stack().pop()),
    sectionFooter('Tap an exercise to give it its own rule.'),
    list,
  );
  return { el: root, refresh };
}

function exercisePage(ctx: AppContext, stack: () => Stack, key: string, name: string): Page {
  const root = el('div', 'settings');
  const footer = sectionFooter();
  footer.dataset.footer = 'exercise';
  const reset = button('row', 'reset', 'Use default', () => {
    ctx.updateSettings(clearExerciseRule(ctx.getSettings(), key));
    sync();
  });

  const rule = () => exerciseRule(ctx.getSettings(), key);
  const target: Stepper = stepper({
    value: rule().target,
    ...TARGET,
    onChange: v => {
      ctx.updateSettings(setExerciseRule(ctx.getSettings(), key, 'target', v));
      sync();
    },
  });
  target.el.dataset.setting = 'target';
  const increment: Stepper = stepper({
    value: rule().increment,
    ...INCREMENT,
    onChange: v => {
      ctx.updateSettings(setExerciseRule(ctx.getSettings(), key, 'increment', v));
      sync();
    },
  });
  increment.el.dataset.setting = 'increment';

  const sync = () => {
    const r = rule();
    target.set(r.target);
    increment.set(r.increment);
    footer.textContent = `${name} goes up ${r.increment} lb after two sessions in a row at ${r.target} reps or more.`;
    reset.hidden = !r.custom;
  };
  sync();

  root.append(
    pageHeader(name, () => stack().pop()),
    setRow('Reps to hit', target.el),
    setRow('Add', increment.el),
    footer,
    reset,
  );
  return { el: root, refresh: sync };
}

function namesPage(ctx: AppContext, stack: () => Stack): Page {
  const root = el('div', 'settings');
  const list = el('div', 'group-list');

  const build = () => {
    list.replaceChildren();
    ctx.getSettings().aliases.forEach((group, index) => {
      const left = el('div', 'nav-label');
      left.append(el('div', 'group-name', group[0]), el('div', 'group-others', group.slice(1).join(', ')));
      const row = navRow(left, () => stack().push(groupPage(ctx, stack, index)));
      row.el.dataset.group = String(index);
      list.append(row.el);
    });
  };
  build();

  root.append(
    pageHeader('Merged names', () => stack().pop()),
    leadingRow('new-group', 'New group', () => stack().push(groupPage(ctx, stack, null))),
    list,
    sectionFooter('Names in a group share one history and one set of suggestions.'),
  );
  return { el: root, refresh: build };
}

function groupPage(ctx: AppContext, stack: () => Stack, initial: number | null): Page {
  const root = el('div', 'settings');
  let slot = initial;
  let draft: string[] = initial === null ? [] : [...ctx.getSettings().aliases[initial]];
  const header = pageHeader('', () => stack().pop());
  const title = header.querySelector('.page-title') as HTMLElement;
  const list = el('div', 'name-list');

  const save = () => {
    const groups = ctx.getSettings().aliases.map(g => [...g]);
    if (slot !== null) {
      if (draft.length >= 2) groups[slot] = [...draft];
      else {
        groups.splice(slot, 1);
        slot = null;
      }
    } else if (draft.length >= 2) {
      groups.push([...draft]);
      slot = groups.length - 1;
    }
    ctx.updateSettings(setAliasGroups(ctx.getSettings(), groups));
  };

  const render = () => {
    title.textContent = draft[0] ?? 'New group';
    list.replaceChildren();
    for (const name of draft) {
      const row = el('div', 'set-row');
      row.dataset.name = name;
      const remove = el('button', 'icon-btn');
      remove.type = 'button';
      remove.dataset.action = 'remove';
      remove.setAttribute('aria-label', `Remove ${name}`);
      remove.append(icon(X, 18));
      pressable(remove);
      remove.addEventListener('click', () => {
        draft = draft.filter(n => n !== name);
        save();
        render();
      });
      row.append(el('span', 'set-label', name), remove);
      list.append(row);
    }
  };

  const add = leadingRow('add-name', 'Add name', () =>
    stack().push(addNamePage(ctx, stack, () => draft, name => {
      draft.push(name);
      save();
    })),
  );

  render();
  root.append(header, list, add, sectionFooter('The first name is the one shown in lists.'));
  return { el: root, refresh: render };
}

function addNamePage(
  ctx: AppContext,
  stack: () => Stack,
  getDraft: () => string[],
  onPick: (name: string) => void,
): Page {
  const root = el('div', 'settings');
  const taken = new Set([...ctx.getSettings().aliases.flat(), ...getDraft()].map(normName));
  const doc = ctx.view.state.field(parsedField);
  const { latest, recent } = spellingIndex(doc, doc.entries.length, []);
  const names = recent.map(k => latest.get(k)!).filter(n => !taken.has(normName(n)));

  root.append(pageHeader('Add name', () => stack().pop()));
  if (!names.length) root.append(sectionFooter('No other names.'));
  for (const name of names) {
    const row = button('row', 'pick', name, () => {
      onPick(name);
      stack().pop();
    });
    row.removeAttribute('data-action');
    row.dataset.name = name;
    root.append(row);
  }
  return { el: root };
}

export function settingsView(ctx: AppContext): HTMLElement {
  let stack!: Stack;
  const get = () => stack;
  stack = createStack(rootPage(ctx, get));
  return stack.el;
}
