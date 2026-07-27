# Notes

## Video Demo: NWS Forecast Reskin Comparison

Working log for creating a demo video comparing the NWS graphical forecast page with the Observable Framework reskin.

### Setup

- Prerequisites verified: marp v4.5.0, shot-scraper v1.11, ffmpeg v8.1.2 — all present
- Dev server running on http://127.0.0.1:3000/ (Observable Framework dev mode)
- NWS original URL: forecast.weather.gov/MapClick.php?FcstType=graphical (lat 36.07, lon -79.10)

### Comparison research

- **Original NWS page**: Server-side PNGs generated from CGI, checkbox-heavy UI, 48-hour fixed view, no hover interaction, no location search
- **Reskin**: Same NDFD API data, Observable Framework + D3/Plot, 6 stacked panels (temperature, sky/humidity/precip, wind, rain, thunder, fog), 7-day horizon, crosshair tooltips, location search, dark mode

Key differences documented:
- Original: numbers locked in PNGs — nothing to scrape from HTML
- Reskin: direct API calls to `/gridpoints/{office}/{x},{y}` — same data, interactive rendering
- Reskin handles interval expansion (PT1H/PT3H/PT5H → uniform hourly grid)
- Reskin computes sunrise/sunset locally (NOAA low-precision almanac) for day/night bands
- Unit conversion: degC/km_h-1 → °F/mph
- Timezone: naive wall-clock strings in forecast's timezone

### Slide deck

- 7 slides created (title + 5 chapters + recap)
- Marp template from skill reference, adjusted for comparison theme
- Rendered to PNGs at 2x scale: 7 slide PNGs generated successfully (124KB–246KB each)

### Storyboard

- 12 scenes: title slide, 5 chapter dividers, 4 live demos (NWS original scroll, reskin full page, 48h view, 7d view), recap
- Live scenes use shot-scraper `scroll`, `click`, `pause`, and `screenshot` actions
- NWS original scene: scroll through the full page to show checkboxes and PNG-based charts
- Reskin scenes: show the full stacked meteogram, then switch time ranges (48h, 7d)

### Video recording

- Recorded successfully: demo.webm (7.0MB) + demo.mp4 (4.9MB)
- Shot-scraper completed all 12 scenes without errors
- Screenshots captured at each key checkpoint

### Issues encountered

- Screenshot output paths in storyboard are relative to CWD, not the storyboard file directory — moved to video-demo/screenshots/ after recording
- scroll `to: "center"` doesn't work (it's a CSS selector, not a keyword) — switched to pixel-based `scroll: {y: N, duration: M}`
- NWS page selectors are fragile due to complex legacy HTML — used `wait_for: body` with pixel scrolling

### Files produced

- `deck.md` — Marp slide deck source
- `slides/slide.001.png` through `slide.007.png` — rendered slides
- `storyboard.yml` — shot-scraper storyboard
- `demo.webm` + `demo.mp4` — recorded video (both formats)
- `screenshots/` — captured screenshots from the recording
