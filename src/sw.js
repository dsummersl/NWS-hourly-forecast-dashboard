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
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
