import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles.css';
import { DEFAULT_SETTINGS } from './core/settings';
import type { Settings } from './core/types';
import { createEditor, scrollCaretIntoView, setSettings } from './editor';
import { platform } from './platform';
import { createMenuButton } from './ui/menu';
import { createStrip } from './ui/strip';
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
  platform.start();

  const text = (await platform.load<string>('text').catch(() => undefined)) ?? '';
  let settings = (await platform.load<Settings>('settings').catch(() => undefined)) ?? DEFAULT_SETTINGS;

  const app = document.getElementById('app')!;
  const editorHost = document.createElement('div');
  editorHost.className = 'editor';

  const textSaver = debounced(() => void platform.save('text', view.state.doc.toString()).catch(() => undefined));
  const settingsSaver = debounced(() => void platform.save('settings', settings).catch(() => undefined));

  const toolbar = createStrip(() => requestAnimationFrame(() => scrollCaretIntoView(view)));
  const view = createEditor({
    parent: editorHost,
    text,
    settings,
    onChange: () => textSaver.schedule(),
    onSuggestion: s => toolbar.setStrip(s.strip),
    onAccept: () => platform.haptic(),
    onFocus: focused => toolbar.setActive(focused),
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
      void platform.save('text', view.state.doc.toString()).catch(() => undefined);
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
}

void boot();
