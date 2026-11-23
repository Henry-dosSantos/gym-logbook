import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { Settings, Suggestion } from '../core/types';
import { topInset } from '../viewport';
import { focusLineField } from './focus-line';
import { ghostExtension } from './ghost';
import { linesField } from './lines';
import { dismissedField, parsedField, setSettings, settingsField, suggestionField } from './state';

export { setSettings };

export function createEditor(opts: {
  parent: HTMLElement;
  text: string;
  settings: Settings;
  onChange(text: string): void;
  onSuggestion(s: Suggestion): void;
  onAccept(): void;
  onFocus(focused: boolean): void;
}): EditorView {
  const state = EditorState.create({
    doc: opts.text,
    selection: { anchor: opts.text.length },
    extensions: [
      settingsField.init(() => opts.settings),
      dismissedField,
      parsedField,
      suggestionField,
      history(),
      ghostExtension,
      linesField,
      focusLineField,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.scrollMargins.of(() => ({
        top: topInset(),
        bottom: document.getElementById('app')?.classList.contains('kb-open') ? 48 : 104,
      })),
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
        if (u.focusChanged) opts.onFocus(u.view.hasFocus);
        if (u.state.field(suggestionField) !== u.startState.field(suggestionField)) {
          opts.onSuggestion(u.state.field(suggestionField));
        }
      }),
    ],
  });
  const view = new EditorView({ state, parent: opts.parent });
  view.dispatch({ effects: EditorView.scrollIntoView(opts.text.length, { y: 'end' }) });
  opts.onSuggestion(view.state.field(suggestionField));
  opts.onFocus(view.hasFocus);
  return view;
}

export function scrollCaretIntoView(view: EditorView): void {
  view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head) });
}
