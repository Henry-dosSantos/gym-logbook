import { StateEffect, StateField } from '@codemirror/state';
import { parseDoc } from '../core/parse';
import { suggest } from '../core/suggest';
import type { Doc, Settings, Suggestion } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/settings';

export const setSettings = StateEffect.define<Settings>();

export const settingsField = StateField.define<Settings>({
  create: () => DEFAULT_SETTINGS,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setSettings)) return e.value;
    return value;
  },
});

export const parsedField = StateField.define<Doc>({
  create: state => parseDoc(state.doc.toString()),
  update: (value, tr) => (tr.docChanged ? parseDoc(tr.state.doc.toString()) : value),
});

export const suggestionField = StateField.define<Suggestion>({
  create: state => compute(state.field(parsedField), state.selection.main, state.field(settingsField)),
  update(value, tr) {
    const settingsChanged = tr.effects.some(e => e.is(setSettings));
    if (!tr.docChanged && !tr.selection && !settingsChanged) return value;
    return compute(tr.state.field(parsedField), tr.state.selection.main, tr.state.field(settingsField));
  },
});

function compute(doc: Doc, sel: { empty: boolean; head: number }, settings: Settings): Suggestion {
  const s = suggest(doc, sel.head, settings, new Date());
  return sel.empty ? s : { ghost: null, strip: s.strip };
}
