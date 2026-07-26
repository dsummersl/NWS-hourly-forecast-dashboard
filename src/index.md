---
title: Hourly Forecast
toc: false
---

<!-- markdownlint-disable MD013 MD033 -->

```js
import * as d3 from "npm:d3";
import {fetchForecast} from "./nws-client.js";

const buildRaw = FileAttachment("data/forecast.json").json();
const runtimeRaw = Mutable(null);
window.__runtimeRaw = runtimeRaw;

// Location picker UI
const picker = html`<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;">
  <input type="text" id="loc-input" placeholder="City, ZIP, or lat,lon…" style="flex:1;padding:6px 10px;border:1px solid var(--theme-foreground-faint);border-radius:4px;background:var(--theme-background);color:var(--theme-foreground);font-size:14px;">
  <button id="loc-go" style="padding:6px 14px;border:1px solid var(--theme-foreground-faint);border-radius:4px;background:var(--theme-background);color:var(--theme-foreground);cursor:pointer;font-size:14px;">Go</button>
</div>`;

const locEl = picker.querySelector("#loc-input");
const goEl = picker.querySelector("#loc-go");

async function updateLocation(lat, lon) {
  try {
    const data = await fetchForecast(lat, lon);
    if (window.__runtimeRaw) window.__runtimeRaw.value = data;
    const p = new URLSearchParams(location.search);
    p.set("lat", Number(lat).toFixed(4));
    p.set("lon", Number(lon).toFixed(4));
    history.replaceState(null, "", `?${p}`);
  } catch (e) {
    console.error("Failed to fetch forecast:", e);
  }
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

locEl.addEventListener("keydown", (e) => { if (e.key === "Enter") goEl.click(); });
```

```js
// Use runtime data when available, otherwise build-time
runtimeRaw; // create reactivity dependency
const raw = runtimeRaw ?? buildRaw;
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
// Read initial state from URL params
const urlParams = new URLSearchParams(location.search);
const initialHours = parseInt(urlParams.get("hours")) || 48;

// Night bands, from the loader's sunrise/sunset table. Two purposes: they make the
// diurnal temperature cycle legible at a glance, and they anchor "which day is this"
// without a tick label on every hour.
const nights = (() => {
  const solarDays = raw.sun.map(d => ({
    sunrise: d.sunrise ? new Date(d.sunrise) : null,
    sunset: d.sunset ? new Date(d.sunset) : null,
  }));
  const out = [];
  if (solarDays[0]?.sunrise > start) out.push({start, end: solarDays[0].sunrise});
  for (let i = 0; i < solarDays.length - 1; i++) {
    if (solarDays[i].sunset && solarDays[i + 1].sunrise) {
      out.push({start: solarDays[i].sunset, end: solarDays[i + 1].sunrise});
    }
  }
  return out;
})();
// Day bands fill the gaps between night bands, so the full timeline alternates.
const days = (() => {
  const out = [];
  let prev = start;
  const end = rows[rows.length - 1].t;
  for (const n of nights) {
    if (n.start > prev) out.push({start: prev, end: n.start});
    prev = n.end;
  }
  if (prev < end) out.push({start: prev, end});
  return out;
})();
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

# Hourly forecast — ${loc.city}, ${loc.state}

<div class="meta" style="margin-bottom: 0.5rem;">
  ${loc.lat}°, ${loc.lon}° · ${loc.elevation_ft} ft · NWS ${loc.office} grid ${loc.gridX},${loc.gridY} ·
  forecast issued ${updatedAt.toLocaleString("en-US", {weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: loc.timeZone})} ${tzLabel}
</div>

${picker}
${rangeInput}

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
const MARGIN = {left: 46, right: 82, top: 16, bottom: 24};

// Every panel shares one x scale and one set of background marks, so the stack reads as
// a single meteogram rather than five unrelated charts.
function frame(yDomain, {showXAxis = false} = {}) {
  return [
    Plot.rect(days, {x1: "start", x2: "end", y1: yDomain[0], y2: yDomain[1], fill: "var(--band-day)", fillOpacity: 0.06}),
    Plot.rect(nights, {x1: "start", x2: "end", y1: yDomain[0], y2: yDomain[1], fill: "var(--band-night)", fillOpacity: 0.1}),
    Plot.ruleX(
      d3.timeDay.range(xDomain[0], xDomain[1]),
      {stroke: FAINT, strokeWidth: 1, strokeOpacity: 0.35}
    ),
    Plot.axisX({
      ticks: d3.timeHour.every(hoursShown <= 24 ? 3 : hoursShown <= 48 ? 6 : 12),
      tickFormat: (t) => t.getHours() === 0 ? d3.timeFormat("%a")(t) : d3.timeFormat("%-I%p")(t).toLowerCase(),
      tickSize: 0,
      fontSize: 10,
      color: MUTED,
      ...(showXAxis ? {} : {tickFormat: () => ""}),
    }),
  ];
}

// Direct labels at the right edge, nudged apart so two series that end at similar
// values don't stack their text on top of each other.
function endLabels(series, yDomain, height) {
  const usable = height - MARGIN.top - MARGIN.bottom;
  const minGap = ((yDomain[1] - yDomain[0]) * 14) / usable;
  const pts = series
    .map(s => {
      const last = [...data].reverse().find(d => d[s.key] != null);
      return last ? {y: last[s.key], label: s.label, fill: s.fill} : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y - pts[i - 1].y < minGap) pts[i].y = pts[i - 1].y + minGap;
  }
  return Plot.text(pts, {
    x: xDomain[1], y: "y", text: "label", fill: d => d.fill,
    textAnchor: "start", dx: 6, fontSize: 11, fontWeight: 600,
  });
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

// Upper-right label inside the chart frame, so each panel is self-identifying
// without relying on external section headers or keys.
function chartLabel(text) {
  return Plot.text([text], {
    frameAnchor: "top-right",
    text: d => d,
    fontSize: 12,
    fontWeight: 600,
    fill: MUTED,
    dx: -8,
    dy: 8,
  });
}

function panel({yDomain, yLabel, yTicks, yTickFormat, marks, height = PANEL_HEIGHT, showXAxis = false, marginBottom = MARGIN.bottom}) {
  return (width) => Plot.plot({
    width, height, marginLeft: MARGIN.left, marginRight: MARGIN.right,
    marginTop: MARGIN.top, marginBottom,
    // Local (not utc) scale: the loader's timestamps are wall-clock text parsed as
    // local Dates, so local ticks and local formatters agree end to end.
    x: {type: "time", domain: xDomain, label: null},
    y: {domain: yDomain, label: yLabel, labelAnchor: "center", grid: true, ticks: yTicks, tickSize: 0, nice: false, tickFormat: yTickFormat},
    style: {fontSize: "11px"},
    marks: [...frame(yDomain, {showXAxis}), ...marks(width)],
  });
}
```

```js
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
  marks: () => [
    Plot.line(data, {x: "t", y: "dewpoint", stroke: C.dew, strokeWidth: 2, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "apparent", stroke: C.feels, strokeWidth: 2, strokeDasharray: "4 3", curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "temperature", stroke: C.temp, strokeWidth: 2, curve: "monotone-x"}),
    endLabels(tempSeries, tempDomain, PANEL_HEIGHT),
    chartLabel("Temperature"),
    ...hoverPips(tempSeries),
    ...crosshair("temperature", (d) => [
      `Temp  ${fmt(d.temperature, "°F")}`,
      `Feels like  ${fmt(S.apparentTemperature?.[d.i], "°F")}`,
      `Dew point  ${fmt(d.dewpoint, "°F")}`,
      `Humidity  ${fmt(d.humidity, "%")}`,
    ]),
  ],
});
```

```js
const skyPrecipRhSeries = [
  {key: "skyCover", label: "Sky cover", fill: MUTED},
  {key: "humidity", label: "Humidity", fill: "var(--series-humid)"},
  {key: "precipChance", label: "Precip", fill: C.dew},
];

const skyPrecipRhPanel = panel({
  yDomain: [0, 100],
  yLabel: "%",
  yTicks: [0, 50, 100],
  height: 190,
  showXAxis: true,
  marks: () => [
    Plot.areaY(data, {x: "t", y: "skyCover", fill: MUTED, fillOpacity: 0.15, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "skyCover", stroke: MUTED, strokeWidth: 2, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "humidity", stroke: "var(--series-humid)", strokeWidth: 2, curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "precipChance", stroke: C.dew, strokeWidth: 2, strokeDasharray: "4 3", curve: "monotone-x"}),
    endLabels(skyPrecipRhSeries, [0, 100], 190),
    chartLabel("Sky, Humidity & Precip"),
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
  marks: () => [
    Plot.line(data, {x: "t", y: "windGust", stroke: C.gust, strokeWidth: 2, strokeDasharray: "4 3", curve: "monotone-x"}),
    Plot.line(data, {x: "t", y: "windSpeed", stroke: C.wind, strokeWidth: 2, curve: "monotone-x"}),
    Plot.image(data.filter(d => d.windDirection != null), {
      x: "t", y: "windSpeed",
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='32' viewBox='-10 -16 20 32'%3E%3Ccircle cx='0' cy='0' r='1.3' fill='%23000'/%3E%3Cline x1='0' y1='0' x2='0' y2='14' stroke='%23777' stroke-width='0.6'/%3E%3Cline x1='0' y1='14' x2='7' y2='14' stroke='%23777' stroke-width='0.6'/%3E%3C/svg%3E",
      width: 20, height: 32,
      rotate: (d) => (d.windDirection ?? 0) - 180,
    }),
    endLabels(windSeries, windDomain, 210),
    chartLabel("Wind"),
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

const COVERAGE_LABELS = ["", "Slight Chance", "Chance", "Likely", "Occasional"];

function weatherPanel(data, label, color) {
  return panel({
    yDomain: [0, 4.5],
    yLabel: null,
    yTicks: [1, 2, 3, 4],
    yTickFormat: (d) => ({1: "SCHC", 2: "CHC", 3: "LKLY", 4: "OCNL"})[d] ?? "",
    height: 150,
    showXAxis: true,
    marks: () => [
      chartLabel(label),
      Plot.rectY(data, {
        x: "t", y1: 0, y2: "level", fill: color,
        interval: d3.timeHour.every(step), insetLeft: 1, insetRight: 1, ry2: 2,
      }),
      Plot.ruleX(data, Plot.pointerX({x: "t", stroke: INK, strokeOpacity: 0.45})),
      Plot.tip(data, Plot.pointerX({
        x: "t", y: "level", fontSize: 12,
        title: (d) => [
          d.t.toLocaleString("en-US", {weekday: "short", hour: "numeric", minute: "2-digit"}),
          `${label}: ${COVERAGE_LABELS[d.level] ?? d.level}`,
        ].join("\n"),
      })),
    ],
  });
}

const rainPanel = panel({
  yDomain: [0, 4.5],
  yLabel: null,
  yTicks: [1, 2, 3, 4],
  yTickFormat: (d) => ({1: "SCHC", 2: "CHC", 3: "LKLY", 4: "OCNL"})[d] ?? "",
    height: 150,
    showXAxis: true,
  marks: () => [
    chartLabel("Rain"),
    Plot.rect(qpfGroups, {
      x1: "start", x2: "end", y1: 0, y2: 1.5,
      fill: "#2a78d6", fillOpacity: 0.3,
      stroke: "#2a78d6", strokeWidth: 0.5, strokeOpacity: 0.4,
    }),
    Plot.text(qpfGroups, {
      x: (d) => new Date((d.start.getTime() + d.end.getTime()) / 2),
      y: 0.75, text: (d) => `${d.value.toFixed(2)}"`,
      fontSize: 11, fill: "var(--qpf-text)", fontWeight: 700, textAnchor: "middle",
    }),
    Plot.rectY(rainData, {
      x: "t", y1: 0, y2: "level", fill: "var(--weather-rain)",
      interval: d3.timeHour.every(step), insetLeft: 1, insetRight: 1, ry2: 2, fillOpacity: 0.5,
    }),
    Plot.ruleX(data, Plot.pointerX({x: "t", stroke: INK, strokeOpacity: 0.45})),
    Plot.tip(rainData, Plot.pointerX({
      x: "t", y: "level", fontSize: 12,
      title: (d) => [
        d.t.toLocaleString("en-US", {weekday: "short", hour: "numeric", minute: "2-digit"}),
        `Rain: ${COVERAGE_LABELS[d.level] ?? d.level}`,
      ].join("\n"),
    })),
  ],
});
const thunderPanel = weatherPanel(thunderData, "Thunder", "var(--weather-thunder)");
const fogPanel = weatherPanel(fogData, "Fog", "var(--weather-fog)");
```

<div class="card" style="padding:0;border:none;background:none;border-radius:0;box-shadow:none;">
  ${resize(tempPanel)}
  ${resize(skyPrecipRhPanel)}
  ${resize(windPanel)}
  ${resize(rainPanel)}
  ${resize(thunderPanel)}
  ${resize(fogPanel)}
</div>

<div class="card" style="padding:0;border:none;background:none;border-radius:0;box-shadow:none;">
<h2>Sources</h2>

Every number on this page comes from one place: the **National Weather Service API**,
which serves the same National Digital Forecast Database grid that
[forecast.weather.gov's graphical forecast](https://forecast.weather.gov/MapClick.php?w0=t&w2=wc&w3=sfcwind&w3u=1&w4=sky&w13u=0&w14u=1&w15u=1&AheadHour=0&Submit=Submit&FcstType=graphical&textField1=${loc.lat}&textField2=${loc.lon}&site=all&unit=0&dd=&bw=)
renders as server-side PNGs.

<ul>
<li>Grid cell: ${html`<a href="https://api.weather.gov/gridpoints/${loc.office}/${loc.gridX},${loc.gridY}"><code>/gridpoints/${loc.office}/${loc.gridX},${loc.gridY}</code></a>`} — issued by NWS ${loc.office}.</li>
<li>Sunrise/sunset are computed locally (NOAA low-precision almanac) for the night bands; the API does not supply them.</li>
<li>Fetched at build time by <code>src/data/forecast.json.py</code>; this copy was pulled ${new Date(raw.generated).toLocaleString("en-US", {dateStyle: "medium", timeStyle: "short"})}.</li>
</ul>
</div>

<style>
.big { font-size: 2rem; font-weight: 600; line-height: 1.2; display: block; }
.muted, .meta { color: var(--theme-foreground-muted); font-size: 13px; }

/* Series colors live here, not in JS, so the theme toggle repaints the charts on its
   own. Both modes are selected steps of the same four hues, each validated against its
   own surface — the dark column is not an automatic lightening of the light one. */
:root {
  --series-temp:  #eb6834;  /* orange */
  --series-dew:   #2a78d6;  /* blue   */
  --series-feels: #1baf7a;  /* aqua   */
  --series-wind:  #5b9bd5;  /* lighter blue for surface wind */
  --series-gust:  #e87ba4;  /* magenta */
  --band-night: #191970;    /* midnight blue */
  --band-day:   #ecd9a0;    /* warm straw */
  --series-humid:   #22c55e;  /* green */
  --weather-rain:   #2a78d6;
  --weather-thunder:#8b5cf6;
  --weather-fog:   #9ca3af;
  --qpf-text: #1a1a2e;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme~="light"])) {
    --series-temp:  #d95926;
    --series-dew:   #3987e5;
    --series-feels: #199e70;
    --series-wind:  #3987e5;
    --series-gust:  #d55181;
    --band-night: #2a3f6b;
    --band-day:   #3a3520;
    --weather-rain:   #3987e5;
    --weather-thunder:#a78bfa;
    --weather-fog:   #6b7280;
    --series-humid:   #16a34a;
    --qpf-text: #fff;
  }
}
:root[data-theme~="dark"] {
  --series-temp:  #d95926;
  --series-dew:   #3987e5;
  --series-feels: #199e70;
  --series-wind:  #3987e5;
  --series-gust:  #d55181;
  --band-night: #2a3f6b;
  --band-day:   #3a3520;
  --weather-rain:   #3987e5;
  --weather-thunder:#a78bfa;
  --weather-fog:   #6b7280;
  --series-humid:   #16a34a;
  --qpf-text: #fff;
}
</style>
