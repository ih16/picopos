import { component$, useVisibleTask$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';
import './styles/app.css';
import { watchActionBarClearance } from './shared/lib/action-bar-clearance';

import { watchTouchTooltips } from './shared/lib/touch-tooltip';

export default component$(() => {
  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(watchActionBarClearance());
      cleanup(watchTouchTooltips());
      if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
        void navigator.serviceWorker
          .register('/picopos-service-worker.js', { updateViaCache: 'none' })
          .catch(() => {
            // Sheets access can still work if the browser prevents offline shell caching.
          });
      }
    },
    { strategy: 'document-ready' },
  );

  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <meta name="google-site-verification" content="RgwJZKsvXkAm5t0DiNWFKjBQzh8eKI-Z6AqBJVtrmIU" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#e8eaee" />
        <link rel="icon" type="image/svg+xml" href="/picopos-mark.svg" />
        <script
          dangerouslySetInnerHTML={`(() => {
          let theme;
          try { theme = localStorage.getItem('picopos.theme'); } catch {}
          if (theme !== 'dark' && theme !== 'light') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          document.documentElement.dataset.theme = theme;
          document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#151922' : '#e8eaee';
        })();`}
        />
        <title>picopos · Inventory & orders</title>
      </head>
      <body>
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
