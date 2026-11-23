import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import { DEFAULT_SETTINGS } from './core/settings';
import type { Settings } from './core/types';
import { createEditor } from './editor';
import { loadValue, saveValue } from './storage';
import { createToolbar } from './ui/toolbar';
import { trackViewport } from './viewport';

const SAVE_DELAY = 300;

async function boot(): Promise<void> {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // persistence is best effort
  }

  const text = (await loadValue<string>('text').catch(() => undefined)) ?? '';
  const settings = (await loadValue<Settings>('settings').catch(() => undefined)) ?? DEFAULT_SETTINGS;

  const app = document.getElementById('app')!;
  const editorHost = document.createElement('div');
  editorHost.className = 'editor';

  let timer: number | undefined;
  const flush = () => {
    window.clearTimeout(timer);
    timer = undefined;
    void saveValue('text', view.state.doc.toString()).catch(() => undefined);
  };

  const toolbar = createToolbar(() => view);
  const view = createEditor({
    parent: editorHost,
    text,
    settings,
    onChange: () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, SAVE_DELAY);
    },
    onSuggestion: s => toolbar.setStrip(s.strip),
  });
  app.append(editorHost, toolbar.el);
  trackViewport(app);
  view.focus();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer !== undefined) flush();
  });
  window.addEventListener('pagehide', () => {
    if (timer !== undefined) flush();
  });
}

void boot();
