import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';

/** Highlights one line (by position), e.g. the lint flag being looked at; null clears it. */
export const setFocusLine = StateEffect.define<number | null>();

const mark = Decoration.line({ class: 'cm-l-focus' });

export const focusLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setFocusLine)) continue;
      next = e.value === null ? Decoration.none : Decoration.set([mark.range(tr.state.doc.lineAt(e.value).from)]);
    }
    return next;
  },
  provide: f => EditorView.decorations.from(f),
});

/** Scrolls line n near the top of the log, with a few lines of context above it, and highlights it. */
export function focusLine(view: EditorView, n: number): void {
  const line = view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
  view.dispatch({
    effects: [setFocusLine.of(line.from), EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 112 })],
  });
}

export function clearFocusLine(view: EditorView): void {
  view.dispatch({ effects: setFocusLine.of(null) });
}
