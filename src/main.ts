import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import { DEFAULT_SETTINGS } from './core/settings';
import type { Settings } from './core/types';
import { createEditor, setSettings } from './editor';
import { loadValue, saveValue } from './storage';
import { createMenuButton } from './ui/menu';
import { createToolbar } from './ui/toolbar';
import { trackViewport } from './viewport';

const SAVE_DELAY = 300;

function debounced(save: () => void): { schedule(): void; flush(): void; pending(): boolean } {
  let timer: number | undefined;
  return {
    schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        save();
      }, SAVE_DELAY);
    },
    flush() {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      save();
    },
    pending: () => timer !== undefined,
  };
}

async function boot(): Promise<void> {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // persistence is best effort
  }

  const text = (await loadValue<string>('text').catch(() => undefined)) ?? '';
  let settings = (await loadValue<Settings>('settings').catch(() => undefined)) ?? DEFAULT_SETTINGS;

  const app = document.getElementById('app')!;
  const editorHost = document.createElement('div');
  editorHost.className = 'editor';

  const textSaver = debounced(() => void saveValue('text', view.state.doc.toString()).catch(() => undefined));
  const settingsSaver = debounced(() => void saveValue('settings', settings).catch(() => undefined));

  const toolbar = createToolbar(() => view);
  const view = createEditor({
    parent: editorHost,
    text,
    settings,
    onChange: () => textSaver.schedule(),
    onSuggestion: s => toolbar.setStrip(s.strip),
  });

  const menuButton = createMenuButton({
    view,
    getSettings: () => settings,
    updateSettings(next) {
      settings = next;
      view.dispatch({ effects: setSettings.of(next) });
      settingsSaver.schedule();
    },
    flushText() {
      void saveValue('text', view.state.doc.toString()).catch(() => undefined);
    },
    flushSettings: settingsSaver.flush,
  });

  app.append(editorHost, toolbar.el, menuButton);
  trackViewport(app);
  view.focus();

  const flushAll = () => {
    textSaver.flush();
    settingsSaver.flush();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
  window.addEventListener('pagehide', flushAll);

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => undefined);
  }
}

void boot();
