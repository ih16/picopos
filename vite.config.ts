import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    solid(),
    {
      name: 'retire-offline-shell-in-dev',
      configureServer(server) {
        // A production preview can leave a cache-first worker on this same origin.
        server.middlewares.use((request, response, next) => {
          if (!['/piecom-service-worker.js', '/picopos-service-worker.js'].includes(request.url ?? ''))
            return next();
          response.setHeader('Content-Type', 'application/javascript');
          response.setHeader('Cache-Control', 'no-store');
          response.end(`
          self.addEventListener('install', () => self.skipWaiting());
          self.addEventListener('activate', event => event.waitUntil((async () => {
            await self.registration.unregister();
            const pages = await self.clients.matchAll({ type: 'window' });
            await Promise.all(pages.map(page => page.navigate(page.url)));
          })()));
        `);
        });
      },
    },
  ],
  build: { rolldownOptions: { input: ['index.html', 'help/index.html'] } },
  server: { host: 'localhost', port: 8899 },
});
