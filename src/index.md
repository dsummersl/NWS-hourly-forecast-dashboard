---
title: Hourly Forecast
toc: false
---

<!-- markdownlint-disable MD013 MD033 -->

```js
import * as d3 from "npm:d3";
import {fetchForecast} from "./nws-client.js";
import {buildBands} from "./bands.js";
import {moonSVGDataURL} from "./moonsvg.js";
import {generateTestData} from "./test-data.js";

const DEFAULT_LAT = 36.01;
const DEFAULT_LON = -79.227;

const urlParams = new URLSearchParams(location.search);
const initialLat = parseFloat(urlParams.get("lat")) || DEFAULT_LAT;
const initialLon = parseFloat(urlParams.get("lon")) || DEFAULT_LON;
const initialHours = parseInt(urlParams.get("hours")) || 48;
const testMode = urlParams.has("test");
```

```js
// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', {type: 'module'});
}
```

```js
// Theme change tick — Mutable that increments when data-theme changes,
// so cells that reference it re-evaluate and update moon colors, etc.
const themeTick = Mutable(0);
{
  const obs = new MutationObserver(() => { themeTick.value++; });
  obs.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
}
```

```js
// Initial data is a Promise; the framework auto-awaits it for other cells.
const initialData = testMode ? generateTestData(initialLat, initialLon, initialHours) : fetchForecast(initialLat, initialLon);
```

```js
// Runtime Mutable — kept in its own cell so it never re-evaluates.
// window ref allows updateLocation (another cell) to set .value.
const runtimeData = Mutable(null);
window.__runtimeData = runtimeData;
```

```js
// Use runtime data when available, otherwise the initial fetch.
const raw = runtimeData ?? initialData;

// Location picker UI
const picker = html`<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;">
  <input type="text" id="loc-input" placeholder="City, ZIP, or lat,lon…" style="flex:1;padding:6px 10px;border:1px solid var(--theme-foreground-faint);border-radius:4px;background:var(--theme-background);color:var(--theme-foreground);font-size:14px;">
  <button id="loc-here" title="Use current location" aria-label="Use current location" style="display:flex;align-items:center;justify-content:center;padding:6px;border:1px solid var(--theme-foreground-faint);border-radius:4px;background:var(--theme-background);color:var(--theme-foreground);cursor:pointer;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7"></circle>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"></circle>
      <line x1="12" y1="1" x2="12" y2="4"></line>
      <line x1="12" y1="20" x2="12" y2="23"></line>
      <line x1="1" y1="12" x2="4" y2="12"></line>
      <line x1="20" y1="12" x2="23" y2="12"></line>
    </svg>
  </button>
  <button id="loc-go" style="padding:6px 14px;border:1px solid var(--theme-foreground-faint);border-radius:4px;background:var(--theme-background);color:var(--theme-foreground);cursor:pointer;font-size:14px;">Go</button>
</div>`;

const locEl = picker.querySelector("#loc-input");
const goEl = picker.querySelector("#loc-go");
const hereEl = picker.querySelector("#loc-here");

async function updateLocation(lat, lon) {
  try {
    const data = testMode ? generateTestData(lat, lon) : await fetchForecast(lat, lon);
    if (window.__runtimeData) window.__runtimeData.value = data;
    const p = new URLSearchParams(location.search);
    p.set("lat", Number(lat).toFixed(4));
    p.set("lon", Number(lon).toFixed(4));
    if (testMode) p.set("test", "1");
    history.replaceState(null, "", `?${p}`);
    updateManifestLink(data.location);
  } catch (e) {
    console.error("Failed to fetch forecast:", e);
  }
}

function updateManifestLink(loc) {
  if (!loc?.city || !loc?.state) return;
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return;
  const p = new URLSearchParams();
  p.set("city", loc.city);
  p.set("state", loc.state);
  p.set("lat", Number(loc.lat).toFixed(4));
  p.set("lon", Number(loc.lon).toFixed(4));
  link.href = `./manifest.json?${p}`;
}

goEl.addEventListener("click", async () => {
  const q = locEl.value.trim();
  if (!q) return;
  const parts = q.split(",").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    await updateLocation(parts[0], parts[1]);
    return;
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
    const results = await r.json();
    if (results.length) {
      await updateLocation(parseFloat(results[0].lat), parseFloat(results[0].lon));
    }
  } catch (e) {
    console.error("Geocoding failed:", e);
  }
});

hereEl.addEventListener("click", () => {
  if (!navigator.geolocation) {
    console.error("Geolocation is not available in this browser.");
    return;
  }
  // Disable while the browser prompts/locates so repeat clicks can't stack requests.
  hereEl.disabled = true;
  hereEl.style.opacity = "0.5";
  const done = () => { hereEl.disabled = false; hereEl.style.opacity = ""; };
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        await updateLocation(pos.coords.latitude, pos.coords.longitude);
      } finally {
        done();
      }
    },
    (err) => {
      console.error("Geolocation failed:", err);
      done();
    },
    {timeout: 10000, maximumAge: 60000}
  );
});

locEl.addEventListener("keydown", (e) => { if (e.key === "Enter") goEl.click(); });
```

```js
const loc = raw.location;
const S = raw.series;

// The loader emits naive local wall-clock strings ("2026-07-26T08:00") on purpose:
// `new Date` reads them back as the same clock time, so 8am in the forecast zone plots
// at 8am no matter what timezone the reader's browser is in.
const rows = raw.hours.map((h, i) => {
  const temperature = S.temperature?.[i] ?? null;
  const apparent = S.apparentTemperature?.[i] ?? null;
  return {
    i,
    t: new Date(h),
    temperature,
    dewpoint: S.dewpoint?.[i] ?? null,
    // "Feels like" is only worth drawing where it actually departs from the air
    // temperature — otherwise it's a second line hugging the first, saying nothing.
    apparent: temperature != null && apparent != null && Math.abs(apparent - temperature) >= 1
      ? apparent
      : null,
    humidity: S.relativeHumidity?.[i] ?? null,
    skyCover: S.skyCover?.[i] ?? null,
    precipChance: S.probabilityOfPrecipitation?.[i] ?? null,
    windSpeed: S.windSpeed?.[i] ?? null,
    windGust: S.windGust?.[i] ?? null,
    windDirection: S.windDirection?.[i] ?? null,
  };
});

const start = rows[0].t;
const updatedAt = new Date(raw.updated);
const tzLabel = new Intl.DateTimeFormat("en-US", {timeZone: loc.timeZone, timeZoneName: "short"})
  .formatToParts(updatedAt).find(p => p.type === "timeZoneName").value;
```

```js
// Update PWA manifest link whenever location changes
updateManifestLink(loc);
```

```js
const bands = buildBands(raw.hours, raw.sun, raw.moon, loc.timeZone);
```

```js
const rangeInput = Inputs.radio(
  new Map([["Next 24 hours", 24], ["Next 48 hours", 48], ["Full 7 days", 168]]),
  {label: "Show", value: initialHours}
);
const hoursShown = view(rangeInput);
```

```js
// Sync hours to URL whenever it changes
{
  const p = new URLSearchParams(location.search);
  p.set("hours", hoursShown);
  history.replaceState(null, "", `?${p}`);
}
```

```js
const data = rows.slice(0, hoursShown);
const xDomain = [data[0].t, data[data.length - 1].t];
const now = data[0];

// A 7-day span at hourly resolution is 168 points: fine for lines, far too dense for
// per-point marks, so anything glyph-shaped (wind barbs, precip bars) gets thinned.
const step = hoursShown <= 24 ? 1 : hoursShown <= 48 ? 2 : 6;
const sampled = data.filter(d => d.i % step === 0);

function fmt(v, unit, digits = 0) {
  return v == null ? "—" : `${v.toFixed(digits)}${unit}`;
}

const compass = (deg) =>
  deg == null ? "—" : ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(deg / 22.5) % 16];


```

# ${loc.city}, ${loc.state}

<div class="meta" style="margin-bottom: 0.5rem;">
  Hourly forecast for ${loc.lat}°, ${loc.lon}° · ${loc.elevation_ft} ft · NWS ${loc.office} grid ${loc.gridX},${loc.gridY} ·
  issued ${updatedAt.toLocaleString("en-US", {weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: loc.timeZone})} ${tzLabel}
</div>

${picker}
${rangeInput}

```js
// Current time — updates every minute for the persistent now-indicator
const currentTime = (() => {
  const m = Mutable(new Date());
  setInterval(() => { m.value = new Date(); }, 60000);
  return m;
})();
```

```js
// Palette: slots 1/2/3/5 of a validated categorical set, with separate light and dark
// steps (see the <style> block at the bottom). Held in CSS variables rather than JS so
// the viewer's theme toggle repaints without re-running anything, and assigned by
// identity — which quantity a line is — never by rank, so changing the time range
// never repaints a series.
const C = {
  temp: "var(--series-temp)",
  dew: "var(--series-dew)",
  feels: "var(--series-feels)",
  wind: "var(--series-wind)",
  gust: "var(--series-gust)",
};

const INK = "var(--theme-foreground)";
const MUTED = "var(--theme-foreground-muted)";
const FAINT = "var(--theme-foreground-faint)";

const PANEL_HEIGHT = 190;
const MARGIN = {left: 46, right: 16, top: 16, bottom: 24};

// Every panel shares one x scale and one set of background marks, so the stack reads as
// a single meteogram rather than five unrelated charts.
currentTime;
function frame(yDomain, {showXAxis = false, pw = 1000} = {}) {
  const tickHours = pw < 400
    ? (hoursShown <= 24 ? 6 : hoursShown <= 48 ? 12 : 24)
    : pw < 700
      ? (hoursShown <= 24 ? 4 : hoursShown <= 48 ? 8 : 12)
      : (hoursShown <= 24 ? 3 : hoursShown <= 48 ? 6 : 12);
  return [
    // Opacity rides in the color so the day band can be tuned per theme from CSS alone
    // — dark mode needs a brighter wash than light mode to read as daylight at all.
    Plot.rect(bands.days, {x1: "start", x2: "end", y1: yDomain[0], y2: yDomain[1], fill: "var(--band-day-wash)", fillOpacity: 1}),
    Plot.rect(bands.nights, {x1: "start", x2: "end", y1: yDomain[0], y2: yDomain[1], fill: "var(--band-night)", fillOpacity: d => 0.28 - (d.moonIllumination ?? 0.5) * 0.20}),
    Plot.ruleX(
      d3.timeDay.range(xDomain[0], xDomain[1]),
      {stroke: FAINT, strokeWidth: 1, strokeOpacity: 0.35}
    ),
    Plot.axisX({
      ticks: d3.timeHour.every(tickHours),
      tickFormat: (t) => t.getHours() === 0 ? d3.timeFormat("%a")(t) : d3.timeFormat("%-I%p")(t).toLowerCase(),
      tickSize: 0,
      fontSize: 10,
      color: MUTED,
      ...(showXAxis ? {} : {tickFormat: () => ""}),
    }),
  ];
}

// Inline legend rendered below each panel instead of right-edge labels.
function legend(series) {
  if (!series?.length) return null;
  return html`<div style="display:flex;gap:1.2rem;flex-wrap:wrap;font:11px var(--sans-serif);margin:0 46px;min-height:18px;">
    ${series.map(s => html`<span style="display:inline-flex;align-items:center;gap:4px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${s.fill};display:inline-block;"></span>
      ${s.label}
    </span>`)}
  </div>`;
}

// One shared crosshair + readout per panel. An hourly forecast is read by picking an
// hour, so the hover layer carries the numbers and the axis stays sparse.
// yField positions the tip at a specific data value (e.g. "temperature") instead
// of floating at the top — matching the wells-project convention of y: "v".
function crosshair(yField, lines) {
  return [
    Plot.ruleX(data, Plot.pointerX({x: "t", stroke: INK, strokeOpacity: 0.45})),
    Plot.tip(data, Plot.pointerX({
      x: "t", y: yField, fontSize: 12,
      title: (d) => [
        d.t.toLocaleString("en-US", {weekday: "short", hour: "numeric", minute: "2-digit"}),
        ...lines(d),
      ].join("\n"),
    })),
  ];
}

// Hover pips for every series in a panel — bigger (r: 6) than the old single pip
// (r: 4.5), and one per line so the user sees exactly which values are being read.
function hoverPips(series) {
  return series.map(s => Plot.dot(data, Plot.pointerX({
    x: "t", y: s.key, r: 6, fill: s.fill,
    stroke: "var(--theme-background)", strokeWidth: 2,
  })));
}

function panel({yDomain, yLabel, yTicks, yTickFormat, marks, height = PANEL_HEIGHT, showXAxis = false, marginBottom = MARGIN.bottom}) {
  return (width) => Plot.plot({
    width, height, marginLeft: MARGIN.left, marginRight: MARGIN.right,
    marginTop: MARGIN.top, marginBottom,
    x: {type: "time", domain: xDomain, label: null},
    y: {domain: yDomain, label: yLabel, labelAnchor: "center", grid: true, ticks: yTicks, tickSize: 0, nice: false, tickFormat: yTickFormat},
    style: {fontSize: "11px"},
    marks: [...frame(yDomain, {showXAxis, pw: width}), ...marks(width)],
  });
}
```

```js
frame;
themeTick;
const tempDomain = (() => {
  const vals = data.flatMap(d => [d.temperature, d.dewpoint, d.apparent]).filter(v => v != null);
  const [lo, hi] = d3.extent(vals);
  const pad = Math.max(3, (hi - lo) * 0.12);
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
})();

const tempSeries = [
  {key: "temperature", label: "Temp", fill: C.temp},
  {key: "apparent", label: "Feels like", fill: C.feels},
  {key: "dewpoint", label: "Dew point", fill: C.dew},
];

const tempPanel = panel({
  yDomain: tempDomain,
  yLabel: "°F",
  showXAxis: true,
  marks: (pw) => {
    const moonBands = bands.nights.filter(d => {
      if (d.moonPhase == null) return false;
      const totalHours = (d.end.getTime() - d.start.getTime()) / 3600000;
      if (totalHours < 3) return false;
      const mid = (d.start.getTime() + d.end.getTime()) / 2;
      if (mid <= xDomain[0].getTime() || mid >= xDomain[1].getTime()) return false;
      const visStart = Math.max(d.start.getTime(), xDomain[0].getTime());
      const visEnd = Math.min(d.end.getTime(), xDomain[1].getTime());
      const visibleHours = (visEnd - visStart) / 3600000;
      if (visibleHours < 4) return false;
      return true;
    });
    const moonInfoMap = new Map();
    for (const band of bands.nights) {
      if (band.moonPhase == null) continue;
      const info = `${band.moonName}  ${(band.moonIllumination * 100).toFixed(0)}% illuminated`;
      for (let t = band.start.getTime(); t < band.end.getTime(); t += 3600000) {
        moonInfoMap.set(t, info);
      }
    }
    const moonSize = Math.min(24, Math.max(14, pw * 0.035));
    let moonMarks = [];
    if (moonBands.length) {
      const midpoints = moonBands.map(d => {
        const visStart = Math.max(d.start.getTime(), xDomain[0].getTime());
        const visEnd = Math.min(d.end.getTime(), xDomain[1].getTime());
        return {
          ...d,
          x: new Date((visStart + visEnd) / 2),
          src: moonSVGDataURL(d.moonPhase, moonSize, 0.3 + (d.moonIllumination ?? 0) * 0.65, getComputedStyle(document.documentElement).getPropertyValue('--moon-fill').trim() || '#ffffff'),
        };
      });
      moonMarks = [
        Plot.image(midpoints, {
          x: "x",
          y: tempDomain[1],
          src: d => d.src,
          width: moonSize,
          height: moonSize,
          dy: moonSize * 0.67,
        }),
      ];
    }
    return [
      Plot.line(data, {x: "t", y: "dewpoint", stroke: C.dew, strokeWidth: 2, curve: "monotone-x"}),
      Plot.line(data, {x: "t", y: "apparent", stroke: C.feels, strokeWidth: 2, strokeDasharray: "4 3", curve: "monotone-x"}),
      Plot.line(data, {x: "t", y: "temperature", stroke: C.temp, strokeWidth: 2, curve: "monotone-x"}),
      ...moonMarks,
      Plot.ruleX([currentTime], {x: d => d, stroke: MUTED, strokeWidth: 1, strokeOpacity: 0.5}),
      Plot.text([currentTime], {
        x: d => d, y: tempDomain[1], dy: 6,
        text: () => "NOW",
        rotate: -90, fontSize: 10,
        fill: MUTED, fontWeight: 600,
        stroke: "var(--theme-background)", strokeWidth: 3, paintOrder: "stroke",
      }),
      ...hoverPips(tempSeries),
      ...crosshair("temperature", (d) => {
        const lines = [
          `Temp  ${fmt(d.temperature, "°F")}`,
          `Feels like  ${fmt(S.apparentTemperature?.[d.i], "°F")}`,
          `Dew point  ${fmt(d.dewpoint, "°F")}`,
          `Humidity  ${fmt(d.humidity, "%")}`,
        ];
        const moonInfo = moonInfoMap.get(d.t.getTime());
        if (moonInfo) lines.push(moonInfo);
        return lines;
      }),
    ];
  },
});
```

```js
frame;
const skyPrecipRhSeries = [
  {key: "skyCover", label: "Sky cover", fill: "var(--series-sky)"},
  {key: "humidity", label: "Humidity", fill: "var(--series-humid)"},
  {key: "precipChance", label: "Precip", fill: C.dew},
];

const skyPrecipRhPanel = panel({
  yDomain: [0, 100],
  yLabel: "%",
  yTicks: [0, 50, 100],
  height: 190,
  showXAxis: true,
  marks: (pw) => [
    Plot.areaY(data, {x: "t", y: "skyCover", fill: "var(--series-sky)", fillOpacity: 0.12, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "skyCover", stroke: "var(--series-sky)", strokeWidth: 1.5, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "humidity", stroke: "var(--series-humid)", strokeWidth: 2, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "precipChance", stroke: C.dew, strokeWidth: 2, strokeDasharray: "4 3", curve: "monotone-x"}),
    Plot.ruleX([currentTime], {x: d => d, stroke: MUTED, strokeWidth: 1, strokeOpacity: 0.5}),
    Plot.text([currentTime], {
      x: d => d, y: 100, dy: 6,
      text: () => "NOW",
      rotate: -90, fontSize: 10,
      fill: MUTED, fontWeight: 600,
      stroke: "var(--theme-background)", strokeWidth: 3, paintOrder: "stroke",
    }),
    ...hoverPips(skyPrecipRhSeries),
    ...crosshair("skyCover", (d) => [
      `Sky cover  ${fmt(d.skyCover, "%")}`,
      `Humidity  ${fmt(d.humidity, "%")}`,
      `Precip  ${fmt(d.precipChance, "%")}`,
    ]),
  ],
});
```

```js
frame;
const windDomain = (() => {
  const hi = d3.max(data, d => Math.max(d.windSpeed ?? 0, d.windGust ?? 0)) ?? 10;
  return [0, Math.ceil((hi * 1.35) / 5) * 5];
})();

const windSeries = [
  {key: "windGust", label: "Gusts", fill: C.gust},
  {key: "windSpeed", label: "Surface", fill: C.wind},
];

const windPanel = panel({
  yDomain: windDomain,
  yLabel: "mph",
  showXAxis: true,
  height: 210,
  marks: (pw) => [
    Plot.line(data, {x: "t", y: "windGust", stroke: C.gust, strokeWidth: 2, strokeDasharray: "4 3", curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "windSpeed", stroke: C.wind, strokeWidth: 2, curve: "monotone-x"}),
    Plot.image(data.filter(d => d.windDirection != null && d.i % Math.max(1, pw < 350 ? 3 : pw < 550 ? 2 : hoursShown > 48 ? 2 : 1) === 0), {
      x: "t", y: "windSpeed",
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='32' viewBox='-10 -16 20 32'%3E%3Ccircle cx='0' cy='0' r='1.3' fill='%23777'/%3E%3Cline x1='0' y1='0' x2='0' y2='14' stroke='%23777' stroke-width='0.6'/%3E%3Cline x1='0' y1='14' x2='7' y2='14' stroke='%23777' stroke-width='0.6'/%3E%3C/svg%3E",
      width: 20, height: 32,
      rotate: (d) => (d.windDirection ?? 0) - 180,
    }),
    Plot.ruleX([currentTime], {x: d => d, stroke: MUTED, strokeWidth: 1, strokeOpacity: 0.5}),
    Plot.text([currentTime], {
      x: d => d, y: windDomain[1], dy: 6,
      text: () => "NOW",
      rotate: -90, fontSize: 10,
      fill: MUTED, fontWeight: 600,
      stroke: "var(--theme-background)", strokeWidth: 3, paintOrder: "stroke",
    }),
    ...hoverPips(windSeries),
    ...crosshair("windSpeed", (d) => [
      `Surface  ${fmt(d.windSpeed, " mph")} from ${compass(d.windDirection)}`,
      `Gusts  ${fmt(d.windGust, " mph")}`,
    ]),
  ],
});

function weatherPoints(series) {
  return (series ?? [])
    .map((level, i) => ({t: data[i]?.t, level, i}))
    .filter(d => d.t && d.level > 0 && d.i % step === 0);
}
const rainData = weatherPoints(S.weather?.rain);
const thunderData = weatherPoints(S.weather?.thunder);
const fogData = weatherPoints(S.weather?.fog);

const qpfGroups = (() => {
  const raw = S.quantitativePrecipitation ?? [];
  const groups = [];
  let start = null, end = null, val = null;
  for (let i = 0; i < raw.length; i++) {
    if (!data[i]?.t) continue;
    const v = raw[i];
    if (v > 0) {
      if (val !== v || end === null) {
        if (start !== null) groups.push({start, end, value: val});
        start = data[i].t;
        end = new Date(data[i].t.getTime() + 3600000);
        val = v;
      } else {
        end = new Date(data[i].t.getTime() + 3600000);
      }
    }
  }
  if (start !== null) groups.push({start, end, value: val});
  return groups;
})();

// QPF bars are labeled with a value, and NWS periods (usually 6h) packed onto a
// narrow mobile screen leave no room to read them. Collapse contiguous periods into
// wider windows (summing their totals) once the panel is too narrow for one-per-period.
const MOBILE_PANEL_WIDTH = 640;
function mergeQpfGroups(groups, maxHours) {
  const maxMs = maxHours * 3600000;
  const merged = [];
  let chunk = null;
  for (const g of groups) {
    if (chunk && g.start.getTime() === chunk.end.getTime() && (g.end.getTime() - chunk.start.getTime()) <= maxMs) {
      chunk = {start: chunk.start, end: g.end, value: chunk.value + g.value};
    } else {
      if (chunk) merged.push(chunk);
      chunk = {start: g.start, end: g.end, value: g.value};
    }
  }
  if (chunk) merged.push(chunk);
  return merged;
}

const COVERAGE_LABELS = ["", "Slight Chance", "Chance", "Likely", "Occasional"];
const COVERAGE_TICKS = {1: "SCHC", 2: "CHC", 3: "LKLY", 4: "OCNL"};

// Rain, thunder and fog share one axis (NWS coverage levels) and rarely overlap, so
// they stack into a single panel. Each gets a distinct *texture* rather than a distinct
// slot: fog is a blurred wash underneath, rain a solid bar, thunder a bolt hatch that
// leaves most of its area transparent so whatever is beneath still reads through.
const SVG_NS = "http://www.w3.org/2000/svg";
let paintSeq = 0;

// Plot exposes no option for SVG filters or pattern fills, so both are attached by
// wrapping the mark's render: build the paint server, drop it in the mark's own <g>,
// then point that <g> at it.
function withPaint(options, makePaint, apply) {
  return {
    ...options,
    render(index, scales, values, dimensions, context, next) {
      const g = next.call(this, index, scales, values, dimensions, context);
      if (!g) return g;
      const id = `wx-paint-${++paintSeq}`;
      const defs = document.createElementNS(SVG_NS, "defs");
      defs.append(makePaint(id));
      g.prepend(defs);
      apply(g, id);
      return g;
    },
  };
}

// Fog has no crisp extent in the real world and shouldn't have one on the chart either.
function fogged(options, stdDeviation = 4) {
  return withPaint(
    options,
    (id) => {
      const filter = document.createElementNS(SVG_NS, "filter");
      filter.setAttribute("id", id);
      // Room for the blur to bleed past the rects' own bounding box.
      filter.setAttribute("x", "-30%");
      filter.setAttribute("y", "-30%");
      filter.setAttribute("width", "160%");
      filter.setAttribute("height", "160%");
      const blur = document.createElementNS(SVG_NS, "feGaussianBlur");
      blur.setAttribute("stdDeviation", stdDeviation);
      filter.append(blur);
      return filter;
    },
    (g, id) => g.setAttribute("filter", `url(#${id})`)
  );
}

// A tile of angled bolts: bright enough to read as a value, sparse enough to see through.
const BOLT_PATH = "M9.2 0 L3 8.4 L6.3 8.4 L4.3 15 L11.4 5.8 L7.8 5.8 L10.4 0 Z";
function boltHatched(options, color) {
  return withPaint(
    options,
    (id) => {
      const pattern = document.createElementNS(SVG_NS, "pattern");
      pattern.setAttribute("id", id);
      pattern.setAttribute("patternUnits", "userSpaceOnUse");
      pattern.setAttribute("width", 14);
      pattern.setAttribute("height", 17);
      pattern.setAttribute("patternTransform", "rotate(-14)");
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", BOLT_PATH);
      path.setAttribute("fill", color);
      path.setAttribute("fill-opacity", "0.95");
      pattern.append(path);
      return pattern;
    },
    (g, id) => {
      g.setAttribute("fill", `url(#${id})`);
      // Plot writes fill per-shape when it varies, so override the shapes too.
      for (const node of g.children) {
        if (node.tagName === "rect" || node.tagName === "path") node.setAttribute("fill", `url(#${id})`);
      }
    }
  );
}

// Tooltip lookups come from the unsampled series, so a hovered hour reports its own
// values even when the bars themselves are thinned out at wider time ranges.
const levelAt = (key, i) => {
  const v = S.weather?.[key]?.[i];
  return v > 0 ? v : null;
};
const qpfAt = (i) => {
  const v = S.quantitativePrecipitation?.[i];
  return v > 0 ? v : null;
};

const wxPanel = panel({
  yDomain: [0, 4.5],
  yLabel: null,
  yTicks: [1, 2, 3, 4],
  yTickFormat: (d) => COVERAGE_TICKS[d] ?? "",
  height: 190,
  showXAxis: true,
  marks: (pw) => {
    const qpfDisplay = pw < MOBILE_PANEL_WIDTH ? mergeQpfGroups(qpfGroups, 12) : qpfGroups;
    return [
      Plot.rectY(rainData, {
        x: "t", y1: 0, y2: "level", fill: "var(--weather-rain)",
        interval: d3.timeHour.every(step), insetLeft: 1, insetRight: 1, ry2: 2, fillOpacity: 0.5,
      }),
      Plot.rectY(fogData, fogged({
        x: "t", y1: 0, y2: "level", fill: "var(--weather-fog)", fillOpacity: 0.65,
        interval: d3.timeHour.every(step), insetLeft: -1, insetRight: -1,
      })),
      Plot.rectY(thunderData, boltHatched({
        x: "t", y1: 0, y2: "level",
        interval: d3.timeHour.every(step), insetLeft: 1, insetRight: 1, ry2: 2,
      }, "var(--weather-thunder)")),
      Plot.rect(qpfDisplay, {
        x1: "start", x2: "end", y1: 0.25, y2: 0.75,
        fill: "var(--qpf-bar)", fillOpacity: 1,
      }),
      Plot.text(qpfDisplay, {
        x: (d) => new Date((d.start.getTime() + d.end.getTime()) / 2),
        y: 0.5, text: (d) => `${d.value.toFixed(2)}"`,
        fontSize: 10, fill: "var(--qpf-text)", fontWeight: 700, textAnchor: "middle",
      }),
      Plot.ruleX([currentTime], {x: d => d, stroke: MUTED, strokeWidth: 1, strokeOpacity: 0.5}),
      Plot.text([currentTime], {
        x: d => d, y: 4.5, dy: 6,
        text: () => "NOW",
        rotate: -90, fontSize: 10,
        fill: MUTED, fontWeight: 600,
        stroke: "var(--theme-background)", strokeWidth: 3, paintOrder: "stroke",
      }),
      Plot.ruleX(data, Plot.pointerX({x: "t", stroke: INK, strokeOpacity: 0.45})),
      Plot.tip(data, Plot.pointerX({
        x: "t", y: () => 0, fontSize: 12,
        title: (d) => {
          const lines = [d.t.toLocaleString("en-US", {weekday: "short", hour: "numeric", minute: "2-digit"})];
          const rain = levelAt("rain", d.i);
          const thunder = levelAt("thunder", d.i);
          const fog = levelAt("fog", d.i);
          const qpf = qpfAt(d.i);
          if (rain) lines.push(`Rain  ${COVERAGE_LABELS[rain] ?? rain}`);
          if (qpf) lines.push(`QPF  ${qpf.toFixed(2)}"`);
          if (thunder) lines.push(`Thunder  ${COVERAGE_LABELS[thunder] ?? thunder}`);
          if (fog) lines.push(`Fog  ${COVERAGE_LABELS[fog] ?? fog}`);
          if (lines.length === 1) lines.push("Clear");
          return lines.join("\n");
        },
      })),
    ];
  },
});

const wxSeries = [
  {key: "rain", label: "Rain", fill: "var(--weather-rain)"},
  {key: "qpf", label: "QPF (in)", fill: "var(--weather-rain)"},
  {key: "thunder", label: "Thunder", fill: "var(--weather-thunder)"},
  {key: "fog", label: "Fog", fill: "var(--weather-fog)"},
];
```

```js
// Active weather alerts callout
const SEVERITY_COLORS = {
  Extreme: "var(--alert-extreme)",
  Severe: "var(--alert-severe)",
  Moderate: "var(--alert-moderate)",
  Minor: "var(--alert-minor)",
};

const alertEntries = raw?.alerts;
const alertCallout = !alertEntries?.length ? null : html`<div style="margin-bottom:1rem;">
  ${alertEntries.map(a => html`<details style="border-left:4px solid ${SEVERITY_COLORS[a.severity] || 'var(--alert-minor)'};background:var(--theme-background);padding:0.5rem 1rem;margin-bottom:0.5rem;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <summary style="cursor:pointer;display:flex;align-items:center;gap:0.5rem;list-style:none;">
      <span style="font-size:1.1rem;">⚠</span>
      <strong>${a.event}</strong>
      <span style="font-size:0.75rem;font-weight:600;text-transform:uppercase;padding:1px 6px;border-radius:3px;color:#fff;background:${SEVERITY_COLORS[a.severity] || 'var(--alert-minor)'};">${a.severity}</span>
    </summary>
    <div style="margin-top:0.5rem;font-size:0.85rem;">
      <div style="color:var(--theme-foreground-muted);margin-bottom:0.5rem;">${a.headline}</div>
      ${a.description ? html`<div style="margin-bottom:0.5rem;white-space:pre-wrap;">${a.description}</div>` : null}
      ${a.instruction ? html`<div style="font-weight:600;white-space:pre-wrap;">${a.instruction}</div>` : null}
    </div>
  </details>`)}
</div>`;
```

${alertCallout || ""}

## Temperature

<div class="chart-container">${resize(tempPanel)}${legend(tempSeries)}</div>

## Sky, Humidity & Precip

<div class="chart-container">${resize(skyPrecipRhPanel)}${legend(skyPrecipRhSeries)}</div>

## Wind

<div class="chart-container">${resize(windPanel)}${legend(windSeries)}</div>

## Rain, Thunder & Fog

<div class="chart-container">${resize(wxPanel)}${legend(wxSeries)}</div>

```js
// Hover state for the bottom summary section
const hoveredIdx = Mutable(null);
window.__hoveredIdx = hoveredIdx;

// Track pointer position over the chart area. Each panel now sits in its own
// container under its own markdown header, so the handlers are bound per panel and
// the tooltip cleanup sweeps across all of them.
{
  data; xDomain;
  const els = Array.from(document.querySelectorAll(".chart-container"));
  const leave = () => { window.__hoveredIdx.value = null; };
  for (const el of els) {
    const handler = (e) => {
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const w = rect.width;
      const scale = d3.scaleTime().domain(xDomain).range([MARGIN.left, w - MARGIN.right]);
      const nearest = d3.minIndex(data, d => Math.abs(d.t - scale.invert(mx)));
      if (window.__hoveredIdx.value !== nearest) window.__hoveredIdx.value = nearest;
    };
    el.addEventListener("pointermove", handler);
    el.addEventListener("pointerleave", leave);
    // Ensure only one Chart tooltip is visible at a time. On tap/click, Plot's
    // pointerX toggles a "sticky" mode — without cleanup, multiple panels can
    // accumulate sticky tooltips, which is especially bad on mobile.
    el.addEventListener("pointerdown", (e) => {
      const targetSvg = e.target.closest("svg") || e.target.ownerSVGElement;
      if (!targetSvg) return;
      // Defer so Plot's pointerdown handler (sticky toggle + render) runs first.
      setTimeout(() => {
        for (const other of els) {
          for (const svg of other.querySelectorAll("svg")) {
            if (svg === targetSvg) continue;
            const tip = svg.querySelector('g[aria-label="tip"]');
            if (tip) tip.replaceChildren();
          }
        }
      }, 0);
    }, true);
  }
}
```

## Sources

- National Digital Forecast Database grid that [forecast.weather.gov's graphical forecast](https://forecast.weather.gov/MapClick.php?w0=t&w2=wc&w3=sfcwind&w3u=1&w4=sky&w13u=0&w14u=1&w15u=1&AheadHour=0&Submit=Submit&FcstType=graphical&textField1=${loc.lat}&textField2=${loc.lon}&site=all&unit=0&dd=&bw=)
- Grid cell: ${html`<a href="https://api.weather.gov/gridpoints/${loc.office}/${loc.gridX},${loc.gridY}"><code>/gridpoints/${loc.office}/${loc.gridX},${loc.gridY}</code></a>`} — issued by NWS ${loc.office}.
- Sunrise/sunset and moon phase are computed locally (astronomy-engine).

<style>
.big { font-size: 2rem; font-weight: 600; line-height: 1.2; display: block; }
.muted, .meta { color: var(--theme-foreground-muted); font-size: 13px; }

/* Each panel is introduced by its own markdown header, so the header needs to sit
   close enough to its chart to read as a caption rather than a new section. */
.chart-container { margin-bottom: 1.5rem; }
h2:has(+ .chart-container) { margin-bottom: 0.25rem; }

/* Series colors live here, not in JS, so the theme toggle repaints the charts on its
   own. Both modes are selected steps of the same four hues, each validated against its
   own surface — the dark column is not an automatic lightening of the light one. */
:root {
  --series-temp:  #eb6834;
  --series-dew:   #2a78d6;
  --series-feels: #1baf7a;
  --series-wind:  #5b9bd5;
  --series-gust:  #e87ba4;
  --band-night: #16162a;
  --band-day:   #ecd9a0;
  --band-day-wash: rgba(236, 217, 160, 0.06);
  --series-sky:   #9ca3af;
  --series-humid:   #22c55e;
  --weather-rain:   #2a78d6;
  --weather-thunder:#e0a400;
  --weather-fog:   #ffffff;
  --fog-opacity: 0.95;
  --qpf-bar: #7b93b0;
  --qpf-text: #1a1a2e;
  --alert-extreme: #dc2626;
  --alert-severe: #ea580c;
  --alert-moderate: #ca8a04;
  --alert-minor: #6b7280;
  --moon-fill: #ffffff;
}
details summary::-webkit-details-marker { display:none; }
details > summary::marker { display:none; content:""; }
details summary { user-select:none; }
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme~="light"])) {
    --series-temp:  #d95926;
    --series-dew:   #3987e5;
    --series-feels: #199e70;
    --series-wind:  #3987e5;
    --series-gust:  #d55181;
    --band-night: #141e3e;
    --band-day:   #c9a030;
    --band-day-wash: rgba(224, 184, 72, 0.10);
    --weather-rain:   #3987e5;
    --weather-thunder:#ffd54a;
    --weather-fog:   #d6dce5;
    --fog-opacity: 0.5;
    --series-sky:   #6b7280;
    --series-humid:   #16a34a;
    --qpf-bar: #8b9db5;
    --qpf-text: #fff;
    --moon-fill: #f0e6c0;
  }
}
:root[data-theme~="dark"] {
  --series-temp:  #d95926;
  --series-dew:   #3987e5;
  --series-feels: #199e70;
  --series-wind:  #3987e5;
  --series-gust:  #d55181;
  --band-night: #141e3e;
  --band-day:   #c9a030;
  --band-day-wash: rgba(224, 184, 72, 0.10);
  --weather-rain:   #3987e5;
  --weather-thunder:#ffd54a;
  --weather-fog:   #94a3b8;
  --fog-opacity: 0.5;
  --series-sky:   #6b7280;
  --series-humid:   #16a34a;
  --qpf-text: #fff;
  --moon-fill: #f0e6c0;
}
@media (max-width: 640px) {
  #observablehq-center { margin: 1rem; }
}
</style>
