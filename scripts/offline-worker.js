function installOfflineShell(version, assets) {
  const prefix = 'picopos-shell-';
  const cacheName = `${prefix}${version}`;
  const assetPaths = new Set(assets);

  self.addEventListener('install', (event) => {
    const requests = assets.map(
      (path) => new Request(new URL(path, self.location.origin), { cache: 'reload' }),
    );
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(requests)));
  });

  self.addEventListener('activate', (event) => {
    // Activate only after the prior worker's tabs are gone, so they have their matching bundle versions.
    event.waitUntil(
      (async () => {
        const outdated = (await caches.keys()).filter(
          (name) => (name.startsWith(prefix) || name.startsWith('piecom-shell-')) && name !== cacheName,
        );
        await Promise.all(outdated.map((name) => caches.delete(name)));
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    const path = url.pathname === '/' && request.mode === 'navigate' ? '/index.html' : url.pathname;
    if (!assetPaths.has(path)) return;

    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        return (await cache.match(path)) ?? fetch(request);
      })(),
    );
  });
}
