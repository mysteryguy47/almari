/*
 * Almari's service worker: lets the installed web app (the iPhone version)
 * open without internet.
 *
 * - Pages: network first, so an update is picked up whenever there is a
 *   connection; offline, the saved copy of the app opens instead.
 * - Built files (hashed names under /_expo/static), fonts, icons and images:
 *   cache first. Their names change with every release, so a cached copy is
 *   never stale.
 * - Family data never passes through here: it lives in IndexedDB on the phone.
 *
 * Bump VERSION to drop every old cache on the next visit.
 */
const VERSION = 'almari-v1';
const SHELL = ['/', '/manifest.json', '/icons/pwa-192.png', '/icons/pwa-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(SHELL);
      // Also save the app's own scripts and styles named in the page, so the very first install works offline.
      const html = await (await fetch('/', { cache: 'no-store' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\/_expo\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Every release has new script names, so without this the cache keeps every
 * old release (several MB each) forever, eating into the space the phone
 * gives Almari, the same space the family data lives in. Built files the
 * latest release no longer uses are removed: those named by the page, plus
 * the lazily loaded ones (like the reader for scanned papers) that the page's
 * scripts name, are kept.
 */
const BUILT = /\/_expo\/static\/[^"'\s)]+/g;

async function dropOldBuilds(cache, response) {
  const html = await response.text();
  const named = new Set(html.match(BUILT) ?? []);
  if (!named.size) return;
  const built = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith('/_expo/static/'));
  const unnamed = built.filter((request) => !named.has(new URL(request.url).pathname));
  if (!unnamed.length) return; // Same release as before: nothing to read.
  for (const path of [...named].filter((p) => p.endsWith('.js'))) {
    // Not saved yet (the page is still loading it): tidy up on a later visit rather than download it twice.
    const script = await cache.match(path);
    if (!script?.ok) return;
    for (const ref of (await script.text()).match(BUILT) ?? []) named.add(ref);
  }
  await Promise.all(unnamed.filter((request) => !named.has(new URL(request.url).pathname)).map((request) => cache.delete(request)));
}

function isStatic(url) {
  return (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:ttf|otf|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Single-page app: every page is the same shell.
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put('/', response.clone());
          if (response.ok) {
            const tidy = dropOldBuilds(cache, response.clone()).catch(() => undefined);
            try {
              event.waitUntil(tidy);
            } catch {
              // Some browsers refuse a late waitUntil; the tidy-up still runs while the worker is awake.
            }
          }
          return response;
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
        return response;
      })(),
    );
  }
});
