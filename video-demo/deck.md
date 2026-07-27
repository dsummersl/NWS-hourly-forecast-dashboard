---
marp: true
size: 16:9
paginate: false
style: |
  :root {
    --ink: #0f172a;
    --muted: #475569;
    --faint: #94a3b8;
    --blue: #2563eb;
    --bg: #f8fafc;
    --line: #e2e8f0;
  }
  section {
    background: var(--bg);
    color: var(--ink);
    font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
    padding: 72px 88px;
    justify-content: center;
  }
  section.title { background: #ffffff; }
  .wordmark {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.02em;
  }
  h1 {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 62px;
    line-height: 1.08;
    letter-spacing: -0.02em;
    margin: 0 0 18px;
  }
  h2 {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700;
    font-size: 46px;
    margin: 0 0 24px;
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-size: 20px;
    font-weight: 600;
    color: var(--blue);
    margin-bottom: 20px;
  }
  .lede { font-size: 28px; color: var(--muted); line-height: 1.45; max-width: 22em; }
  ul { font-size: 26px; line-height: 1.7; color: var(--ink); margin: 0; }
  ul.muted li { color: var(--muted); }
  li strong { color: var(--ink); }
  .rule { width: 64px; height: 5px; background: var(--blue); border-radius: 3px; margin: 0 0 28px; }
  .chapno { font-size: 120px; font-weight: 700; color: var(--line); font-family: Georgia, serif; line-height: 1; margin-bottom: 8px; }
  .foot { position: absolute; bottom: 44px; left: 88px; color: var(--faint); font-size: 18px; letter-spacing: 0.02em; }
  .cols { display: flex; gap: 64px; }
  .cols > div { flex: 1; }
  .colhead { font-size: 18px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--faint); margin-bottom: 14px; }
---

<!-- _class: title -->

<div class="wordmark" style="font-size:34px;">NWS · Hourly Forecast</div>

<div style="height:70px;"></div>

<div class="eyebrow">UI Comparison Demo</div>

# NWS Graphical Forecast Reskin

<div class="lede">Rebuilding the National Weather Service meteogram as an interactive, modern dashboard using Observable Framework and D3/Observable Plot</div>

<div class="foot">NWS forecast-viz - July 2026</div>

---

<div class="eyebrow">The Original</div>

# NWS Graphical Forecast Page

<div class="lede">Server-rendered PNGs, checkbox-driven UI, and a 48-hour fixed view - the NDFD numbers are there, but locked inside images</div>

<div class="foot">forecast.weather.gov/MapClick.php</div>

---

<div class="eyebrow">Data Pipeline</div>

# From PNGs to Live JSON

<div class="lede">The original page generates server-side PNGs from a CGI script. The reskin calls the same NDFD grid API directly - fetching, expanding interval-based time series, and rendering everything in the browser</div>

<div class="foot">National Digital Forecast Database - api.weather.gov</div>

---

<div class="eyebrow">Interactivity</div>

# The Reskin

<div class="cols">
<div>
<div class="colhead">Capabilities</div>

- **Location search** - city, ZIP, or lat/lon
- **Crosshair tooltips** - exact values on hover
- **Day/night bands** - diurnal cycle at a glance with moon phases
- **PWA** - save as an app on your phone.

</div>
<div>
<div class="colhead">Quality of Life</div>

<ul class="muted">
<li><strong>Dark mode</strong> - CSS custom properties, no JS</li>
<li><strong>Time range selector</strong> - 24h / 48h / 7d, replaces the fixed 48h</li>
<li><strong>Feels-like shown only where it differs</strong></li>
<li><strong>Single shared time axis</strong> across all 6 panels</li>
<li><strong>No page reloads</strong> - reactive data flow</li>
</ul>

</div>
</div>

---

<div class="eyebrow">Architecture</div>

# How It Works

<div class="cols">
<div>
<div class="colhead">Data Layer</div>

- **NWS API** - `/points/{lat},{lon}` → grid cell
- **Gridpoint endpoint** - 11 NDFD elements fetched
- **Interval expansion** - PT1H/PT3H/PT5H → hourly grid
- **Sunrise/sunset & moon phase** - astronomy-engine computation

</div>
<div>
<div class="colhead">Rendering Layer</div>

<ul class="muted">
<li><strong>Observable Framework</strong> - static site + reactive JS</li>
<li><strong>Observable Plot</strong> - 6 stacked panels</li>
<li><strong>CSS custom properties</strong> - theme without JS re-run</li>
<li><strong>GitHub Pages deploy</strong> - cron rebuilds every 6 hours</li>
</ul>

</div>
</div>
