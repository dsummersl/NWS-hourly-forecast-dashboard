const CACHE = 'nws-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.includes('manifest') && url.pathname.endsWith('.json')) {
    event.respondWith(generateManifest(url));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const clone = response.clone();
        const cache = await caches.open(CACHE);
        if (event.request.method === 'GET' && response.ok) {
          cache.put(event.request, clone);
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        return cached ?? new Response('Offline', { status: 503 });
      }
    })()
  );
});

async function generateManifest(url) {
  const city = url.searchParams.get('city');
  const state = url.searchParams.get('state');
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  const name = city && state ? `${city} NWS` : 'NWS Hourly Forecast';
  const shortName = city && state ? `${city} NWS` : 'Hourly Fcst';
  const startUrl = lat && lon ? `./?lat=${parseFloat(lat).toFixed(4)}&lon=${parseFloat(lon).toFixed(4)}` : '.';
  const widgetUrl = lat && lon ? `./widget?lat=${parseFloat(lat).toFixed(4)}&lon=${parseFloat(lon).toFixed(4)}` : './widget';

  const manifest = {
    name,
    short_name: shortName,
    description: 'Hourly forecast dashboard powered by the National Weather Service API',
    start_url: startUrl,
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      {
        src: './icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
    shortcuts: [
      {
        name: '24-Hour Forecast Widget',
        short_name: 'Widget',
        description: 'View next 24 hours temperature widget',
        url: widgetUrl,
        icons: [
          {
            src: './icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
        ],
      },
    ],
    widgets: [
      {
        name: '24h Temperature Widget',
        short_name: 'Temp Widget',
        description: 'Shows upcoming 24-hour temperature forecast',
        tag: 'temp-widget',
        ms_ac_template: './widget',
        data: './widget',
        type: 'text/html',
        src: widgetUrl,
        sizes: '300x200',
        screenshots: [
          {
            src: './widget-preview.png',
            sizes: '1280x800',
            type: 'image/png',
            label: '24-Hour Temperature Widget',
          },
        ],
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
