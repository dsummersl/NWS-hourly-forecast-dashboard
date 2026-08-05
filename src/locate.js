// Location lookup helpers for the picker in index.md.
//
// The geolocation API has a failure mode that looks exactly like "nothing happened":
// if the permission prompt is dismissed (or the page is embedded/served somewhere the
// API is blocked) neither callback is ever invoked, so a naive getCurrentPosition call
// leaves the UI stuck with no error to show. Everything here funnels into a settled
// promise — success, mapped error, or watchdog timeout — so the caller can always
// report an outcome.

export const GEO_ERROR_MESSAGES = {
  1: "Location permission was denied. Allow location access for this site in your browser settings.",
  2: "Your device could not determine a position.",
  3: "Timed out waiting for a position.",
};

export function describeGeolocationError(err) {
  if (!err) return "Location lookup failed.";
  const byCode = GEO_ERROR_MESSAGES[err.code];
  if (byCode) return byCode;
  return err.message || "Location lookup failed.";
}

// Returns {lat, lon} for "36.01, -79.227", or null for anything else.
export function parseLatLon(query) {
  const parts = String(query ?? "").split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lon = parseFloat(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {lat, lon};
}

// Best-effort read of the geolocation permission state — purely for diagnostics, since
// a "denied" state is the one case where the browser shows no prompt and the click
// genuinely appears to do nothing.
export async function geolocationPermissionState(nav = globalThis.navigator) {
  try {
    if (!nav?.permissions?.query) return "unsupported";
    const status = await nav.permissions.query({name: "geolocation"});
    return status?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}

// getCurrentPosition as a promise that is guaranteed to settle. `timeout` is handed to
// the browser; `watchdogMs` covers the case where the browser never calls back at all.
export function requestPosition({
  nav = globalThis.navigator,
  timeout = 10000,
  maximumAge = 60000,
  watchdogMs = timeout + 5000,
  onLog = () => {},
} = {}) {
  return new Promise((resolve, reject) => {
    if (!nav?.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    if (globalThis.isSecureContext === false) {
      reject(new Error("Geolocation requires a secure (https) connection."));
      return;
    }

    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      fn(arg);
    };

    const watchdog = setTimeout(() => {
      finish(reject, new Error(
        "The browser never answered the location request — the permission prompt may " +
        "have been dismissed or blocked."
      ));
    }, watchdogMs);

    onLog("requesting position", {timeout, maximumAge, watchdogMs});
    nav.geolocation.getCurrentPosition(
      (pos) => finish(resolve, pos),
      (err) => {
        const mapped = new Error(describeGeolocationError(err));
        mapped.code = err?.code;
        finish(reject, mapped);
      },
      {timeout, maximumAge, enableHighAccuracy: false}
    );
  });
}

// Forward geocode a free-text place name via Nominatim.
export async function geocode(query, {fetchImpl = globalThis.fetch} = {}) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`Geocoding service returned ${r.status}`);
  const results = await r.json();
  if (!results?.length) return null;
  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    label: results[0].display_name,
  };
}
