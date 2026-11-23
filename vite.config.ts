import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'logbook-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map(f => relative(outDir, f).split('\\').join('/'))
        .filter(f => f !== 'sw.js')
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const cache = `logbook-${hash.digest('hex').slice(0, 12)}`;
      const assets = ['./', ...files.filter(f => f !== 'index.html')];
      const source = `const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      if (request.mode === 'navigate') {
        return caches.match(new URL('./', self.registration.scope).href).then(page => page || fetch(request));
      }
      return fetch(request);
    }),
  );
});
`;
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

export default defineConfig({ base: '/gym-logbook/', plugins: [serviceWorker()] });
