import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';

/** Highlights one line (by position), e.g. the lint flag being looked at, with its fix after it; null clears it. */
export const setFocusLine = StateEffect.define<{ pos: number; fix: string | null } | null>();

// The fix is shown with CSS ::after from data-fix, like the ghost text: no widget in the editable DOM.
const mark = (fix: string | null) =>
  Decoration.line({ class: 'cm-l-focus', attributes: fix === null ? {} : { 'data-fix': `→ ${fix}` } });

export const focusLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setFocusLine)) continue;
      next =
        e.value === null ? Decoration.none : Decoration.set([mark(e.value.fix).range(tr.state.doc.lineAt(e.value.pos).from)]);
    }
    return next;
  },
  provide: f => EditorView.decorations.from(f),
});

/** Scrolls line n near the top of the log, with a few lines of context above it, and highlights it. */
export function focusLine(view: EditorView, n: number, fix: string | null = null): void {
  const line = view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
  view.dispatch({
    effects: [setFocusLine.of({ pos: line.from, fix }), EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 112 })],
  });
}

export function clearFocusLine(view: EditorView): void {
  view.dispatch({ effects: setFocusLine.of(null) });
}
