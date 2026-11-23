import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { Settings, Suggestion } from '../core/types';
import { ghostExtension } from './ghost';
import { linesField } from './lines';
import { parsedField, setSettings, settingsField, suggestionField } from './state';

export { setSettings };

export function createEditor(opts: {
  parent: HTMLElement;
  text: string;
  settings: Settings;
  onChange(text: string): void;
  onSuggestion(s: Suggestion): void;
  onAccept(): void;
}): EditorView {
  const state = EditorState.create({
    doc: opts.text,
    selection: { anchor: opts.text.length },
    extensions: [
      settingsField.init(() => opts.settings),
      parsedField,
      suggestionField,
      history(),
      ghostExtension,
      linesField,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        autocorrect: 'off',
        spellcheck: 'false',
        autocapitalize: 'sentences',
        'aria-label': 'Workout log',
      }),
      EditorView.theme({}, { dark: true }),
      EditorView.updateListener.of(u => {
        if (u.docChanged) opts.onChange(u.state.doc.toString());
        if (u.transactions.some(tr => tr.isUserEvent('input.complete'))) opts.onAccept();
        if (u.state.field(suggestionField) !== u.startState.field(suggestionField)) {
          opts.onSuggestion(u.state.field(suggestionField));
        }
      }),
    ],
  });
  const view = new EditorView({ state, parent: opts.parent });
  view.dispatch({ effects: EditorView.scrollIntoView(opts.text.length, { y: 'end' }) });
  opts.onSuggestion(view.state.field(suggestionField));
  return view;
}
