import { StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import type { Doc } from '../core/types';
import { parsedField } from './state';

const dateLine = Decoration.line({ class: 'cm-l-date' });
const noteLine = Decoration.line({ class: 'cm-l-note' });
const lint = Decoration.mark({ class: 'cm-lint' });

function build(doc: Doc): DecorationSet {
  const ranges = [];
  for (const l of doc.lines) {
    if (l.kind === 'date') ranges.push(dateLine.range(l.from));
    else if (l.kind === 'note') ranges.push(noteLine.range(l.from));
    if (l.flags.length && l.to > l.from) ranges.push(lint.range(l.from, l.to));
  }
  return Decoration.set(ranges, true);
}

export const linesField = StateField.define<DecorationSet>({
  create: state => build(state.field(parsedField)),
  update: (value, tr) => (tr.docChanged ? build(tr.state.field(parsedField)) : value),
  provide: f => EditorView.decorations.from(f),
});
