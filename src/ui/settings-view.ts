import type { EditorView } from '@codemirror/view';
import { exerciseList } from '../core/suggest';
import { parsedField } from '../editor/state';
import type { ExerciseSetting, Settings } from '../core/types';
import { el } from './dom';

export interface AppContext {
  view: EditorView;
  getSettings(): Settings;
  updateSettings(next: Settings): void;
  flushText(): void;
  flushSettings(): void;
}

function parsePositive(value: string): number | undefined {
  const n = Number(value.trim());
  return value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

function withExercise(settings: Settings, key: string, field: keyof ExerciseSetting, value: number | undefined): Settings {
  const entry: ExerciseSetting = { ...settings.exercises[key] };
  if (value === undefined) delete entry[field];
  else entry[field] = value;
  const exercises = { ...settings.exercises };
  if (Object.keys(entry).length) exercises[key] = entry;
  else delete exercises[key];
  return { ...settings, exercises };
}

export function aliasesToText(aliases: string[][]): string {
  return aliases.map(g => g.join(', ')).join('\n');
}

export function parseAliases(text: string): string[][] {
  return text
    .split('\n')
    .map(line => line.split(',').map(s => s.trim()).filter(Boolean))
    .filter(group => group.length >= 2);
}

export function settingsView(ctx: AppContext): HTMLElement {
  const root = el('div', 'settings');
  const settings = ctx.getSettings();
  const doc = ctx.view.state.field(parsedField);

  root.append(el('div', 'section-label', 'Exercises'));
  const header = el('div', 'ex-row ex-header');
  header.append(el('span'), el('span', '', 'Target'), el('span', '', 'Step'));
  root.append(header);

  const makeInput = (field: 'target' | 'increment', key: string, placeholder: string) => {
    const input = el('input', 'num');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.dataset.field = field;
    input.dataset.key = key;
    input.placeholder = placeholder;
    const current = settings.exercises[key]?.[field];
    if (current !== undefined) input.value = String(current);
    input.addEventListener('input', () => {
      ctx.updateSettings(withExercise(ctx.getSettings(), key, field, parsePositive(input.value)));
    });
    return input;
  };

  for (const item of exerciseList(doc, settings.aliases)) {
    const row = el('div', 'ex-row');
    row.append(
      el('span', 'ex-name', item.name),
      makeInput('target', item.key, '4'),
      makeInput('increment', item.key, '5'),
    );
    root.append(row);
  }

  root.append(el('div', 'section-label', 'Aliases'));
  const area = el('textarea', 'field');
  area.dataset.field = 'aliases';
  area.value = aliasesToText(settings.aliases);
  area.setAttribute('autocorrect', 'off');
  area.setAttribute('autocapitalize', 'off');
  area.spellcheck = false;
  area.style.minHeight = '30vh';
  area.addEventListener('input', () => {
    ctx.updateSettings({ ...ctx.getSettings(), aliases: parseAliases(area.value) });
  });
  root.append(area);
  return root;
}
