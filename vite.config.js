import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function walk(dir, root, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, out);
    else if (!entry.name.endsWith('.map') && entry.name !== 'sw.js') {
      out.push(`./${path.relative(root, full).split(path.sep).join('/')}`);
    }
  }
}

function serviceWorker() {
  return {
    name: 'chronostasis-sw',
    apply: 'build',
    closeBundle() {
      const root = path.resolve('dist');
      const assets = [];
      walk(root, root, assets);
      const id = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
      const source = `const CACHE = 'chronostasis-${id}';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    return fetch(event.request);
  })());
});
`;
      fs.writeFileSync(path.join(root, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  plugins: [serviceWorker()],
});
