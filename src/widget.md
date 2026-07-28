---
title: Weather Widget
toc: false
sidebar: false
pager: false
---

<!-- markdownlint-disable MD013 MD033 -->

```js
import * as d3 from "npm:d3";
import * as Plot from "npm:@observablehq/plot";
import {fetchForecast} from "./nws-client.js";
import {buildBands} from "./bands.js";
import {computeWidgetWindow, filterWidgetData, getCurrentTempSummary, buildWidgetPlotSpec} from "./widget-temp.js";

const DEFAULT_LAT = 36.01;
const DEFAULT_LON = -79.227;

const urlParams = new URLSearchParams(location.search);
const lat = parseFloat(urlParams.get("lat")) || DEFAULT_LAT;
const lon = parseFloat(urlParams.get("lon")) || DEFAULT_LON;
const pastHours = parseInt(urlParams.get("past")) || 2;
```

```js
const raw = await fetchForecast(lat, lon);
const loc = raw.location;
const S = raw.series;

const rows = raw.hours.map((h, i) => {
  const temperature = S.temperature?.[i] ?? null;
  const apparent = S.apparentTemperature?.[i] ?? null;
  return {
    i,
    t: new Date(h),
    temperature,
    dewpoint: S.dewpoint?.[i] ?? null,
    apparent: temperature != null && apparent != null && Math.abs(apparent - temperature) >= 1 ? apparent : null,
    humidity: S.relativeHumidity?.[i] ?? null,
  };
});

const bands = buildBands(raw.hours, raw.sun, raw.moon, loc.timeZone);

const now = new Date();
const { xStart, xEnd, xDomain } = computeWidgetWindow(now, pastHours, 24);
const widgetData = filterWidgetData(rows, xStart, xEnd);
const current = getCurrentTempSummary(rows, now);
```

<div class="widget-card">
  <div class="widget-header">
    <div class="widget-location">
      <span class="location-name">${loc.city}, ${loc.state}</span>
      <span class="location-meta">24-Hour Temperature Forecast</span>
    </div>
    <div class="widget-temp-badge">
      <span class="temp-val">${current?.temperature != null ? Math.round(current.temperature) + "°" : "—"}</span>
      <div class="temp-sub">
        ${current?.apparent != null ? html`<span>Feels <strong>${Math.round(current.apparent)}°</strong></span>` : ""}
        ${current?.dewpoint != null ? html`<span>Dew <strong>${Math.round(current.dewpoint)}°</strong></span>` : ""}
      </div>
    </div>
  </div>

  <div class="widget-chart">
    ${resize((width) => Plot.plot(buildWidgetPlotSpec({ Plot, data: widgetData, bands, xDomain, now, width, height: 180 })))}
  </div>
</div>

<details class="embed-box">
  <summary><strong>Embed this widget in your app</strong></summary>
  <p style="margin: 0.5rem 0 0.25rem 0; font-size: 0.85rem; color: var(--theme-foreground-muted);">
    Copy this iframe snippet into your website or web app:
  </p>
  <pre><code>&lt;iframe src="${location.origin}${location.pathname}?lat=${lat}&lon=${lon}" width="500" height="260" frameborder="0" style="border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15);"&gt;&lt;/iframe&gt;</code></pre>
</details>

<style>
:root {
  --series-temp:  #eb6834;
  --series-dew:   #2a78d6;
  --series-feels: #1baf7a;
  --band-night: #16162a;
  --band-day:   #ecd9a0;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme~="light"])) {
    --series-temp:  #d95926;
    --series-dew:   #3987e5;
    --series-feels: #199e70;
    --band-night: #141e3e;
    --band-day:   #c9a030;
  }
}

body {
  margin: 0;
  padding: 1rem;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.widget-card {
  background: var(--theme-background-alt, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--theme-foreground-faint, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  padding: 1rem;
  max-width: 600px;
  margin: 0 auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--theme-foreground-faint, rgba(255, 255, 255, 0.1));
}

.widget-location {
  display: flex;
  flex-direction: column;
}

.location-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--theme-foreground, #fff);
}

.location-meta {
  font-size: 0.75rem;
  color: var(--theme-foreground-muted, #aaa);
  margin-top: 2px;
}

.widget-temp-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.temp-val {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--series-temp, #eb6834);
  line-height: 1;
}

.temp-sub {
  display: flex;
  flex-direction: column;
  font-size: 0.75rem;
  color: var(--theme-foreground-muted, #aaa);
}

.widget-chart {
  width: 100%;
}

.embed-box {
  max-width: 600px;
  margin: 1.5rem auto 0 auto;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--theme-background-alt, rgba(255, 255, 255, 0.03));
  border: 1px dashed var(--theme-foreground-faint, rgba(255, 255, 255, 0.15));
}

.embed-box pre {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.8rem;
}
</style>
