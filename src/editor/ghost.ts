import { Prec, StateEffect, StateField, Transaction } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, keymap } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { isolateHistory } from '@codemirror/commands';
import { dismissGhostEffect, suggestionField } from './state';

function build(view: EditorView): DecorationSet {
  const { ghost } = view.state.field(suggestionField);
  const sel = view.state.selection.main;
  if (!ghost || view.composing || !sel.empty) return Decoration.none;
  const line = view.state.doc.lineAt(sel.head);
  const deco = Decoration.line({
    attributes: { 'data-ghost': ghost.text },
    class: line.text === '' ? 'cm-ghost-line cm-ghost-empty' : 'cm-ghost-line',
  });
  return Decoration.set([deco.range(line.from)]);
}

const ghostPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      this.decorations = build(u.view);
    }
  },
  { decorations: v => v.decorations },
);

const markAccepted = StateEffect.define<{ from: number; to: number }>();
const clearAccepted = StateEffect.define<null>();

const acceptedField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(markAccepted) && e.value.to > e.value.from) {
        value = Decoration.set([Decoration.mark({ class: 'cm-accepted' }).range(e.value.from, e.value.to)]);
      } else if (e.is(clearAccepted)) value = Decoration.none;
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f),
});

export function acceptGhost(view: EditorView): boolean {
  const { ghost } = view.state.field(suggestionField);
  const sel = view.state.selection.main;
  if (!ghost || view.composing || !sel.empty) return false;
  const from = sel.head;
  const to = from + ghost.text.length;
  view.dispatch({
    changes: { from, insert: ghost.text },
    selection: { anchor: to },
    scrollIntoView: true,
    effects: markAccepted.of({ from, to }),
    annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.complete')],
  });
  setTimeout(() => {
    if (view.dom.isConnected) view.dispatch({ effects: clearAccepted.of(null) });
  }, 160);
  return true;
}

export function dismissGhost(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (view.composing || !sel.empty || !view.state.field(suggestionField).ghost) return false;
  if (view.state.doc.lineAt(sel.head).text !== '') return false;
  view.dispatch({ effects: dismissGhostEffect.of(sel.head) });
  return true;
}

export function insertNewline(view: EditorView): boolean {
  view.dispatch({ ...view.state.replaceSelection('\n'), scrollIntoView: true, userEvent: 'input' });
  return true;
}

export const ghostExtension: Extension = [
  suggestionField,
  ghostPlugin,
  acceptedField,
  Prec.highest(keymap.of([
      { key: 'Enter', run: v => acceptGhost(v) || insertNewline(v) },
      { key: 'Backspace', run: dismissGhost },
    ])),
  EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== ' ' || from !== to || view.composing) return false;
    const sel = view.state.selection.main;
    const { ghost } = view.state.field(suggestionField);
    if (!sel.empty || sel.head !== from || !ghost || !ghost.space) return false;
    return acceptGhost(view);
  }),
];
