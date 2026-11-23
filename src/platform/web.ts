import type { Platform } from './index';

const DB_NAME = 'logbook';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function fallbackCopy(text: string): void {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.append(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {
    // copy is best effort
  }
  area.remove();
}

export const web: Platform = {
  start() {
    try {
      void navigator.storage?.persist?.().catch(() => undefined);
    } catch {
      // persistence is best effort
    }
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => undefined);
    }
  },

  load<T>(key: string): Promise<T | undefined> {
    return run('readonly', store => store.get(key) as IDBRequest<T | undefined>);
  },

  async save(key, value) {
    await run('readwrite', store => store.put(value, key));
  },

  copy(text) {
    let pending: Promise<void> | undefined;
    try {
      pending = navigator.clipboard?.writeText(text);
    } catch {
      pending = undefined;
    }
    if (!pending) fallbackCopy(text);
    else pending.catch(() => fallbackCopy(text));
  },

  haptic() {
    try {
      navigator.vibrate?.(8);
    } catch {
      // no haptics available
    }
  },
};
