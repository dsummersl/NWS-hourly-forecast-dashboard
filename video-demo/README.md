# NWS Hourly Forecast Reskin — Video Demo

A narrated screen recording comparing the **National Weather Service graphical forecast page** with an **Observable Framework reskin** that replaces server-rendered PNGs with an interactive meteogram.

## The comparison

| | Original NWS Page | Observable Reskin |
|---|---|---|
| **Rendering** | Server-side PNGs (CGI) | Client-side D3/Plot |
| **Data source** | NDFD grid (same) | NDFD grid (same API) |
| **Time horizon** | 48 hours fixed | 24h / 48h / 7d selectable |
| **Location** | Hardcoded URL params | Search by city, ZIP, or lat/lon |
| **Interaction** | None (static images) | Crosshair tooltips, hover readouts |
| **Panels** | Single PNG stack | 6 stacked panels: temp, sky/precip, wind, rain, thunder, fog |
| **Day/night** | None | Night bands from computed sunrise/sunset |
| **Dark mode** | No | CSS custom properties, no JS re-run |
| **Wind direction** | None | Direction barbs inline on wind panel |
| **Deploy** | NWS servers | GitHub Pages, cron rebuild every 6h |

## Demo video contents

1. **Title slide** — overview of the comparison
2. **Original NWS page** — live scroll through the checkbox UI and PNG-based forecast
3. **Reskin home page** — the full Observable Framework meteogram
4. **Panel scroll** — scrolling through all 6 stacked panels
5. **48-hour view** — time range selector in action
6. **7-day horizon** — the full 168-hour forecast
7. **Data pipeline** — how the reskin gets live NDFD data
8. **Interactivity features** — what the reskin adds
9. **Architecture** — data layer and rendering layer
10. **Recap** — side-by-side summary

## Files

- `demo.mp4` / `demo.webm` — the recorded video (4.9MB / 7.0MB)
- `deck.md` — Marp slide deck source
- `slides/` — rendered slide PNGs
- `storyboard.yml` — shot-scraper storyboard
- `screenshots/` — captured screenshots

## How to rebuild

```bash
# Render slides
marp deck.md --images png --image-scale 2 -o slides/slide.png

# Record video
uv tool run shot-scraper video storyboard.yml -o demo.webm --mp4
```

## What was skipped

- **Hover tooltip demonstration**: shot-scraper's `hover` action is unreliable for SVG elements rendered by Observable Plot. The crosshair tooltips are described in the slides but not shown live in the recording.
- **Location search**: entering a city name triggers a Nominatim API call, which was not reliable to automate in the recording.
- **Dark mode toggle**: Observable Framework's built-in theme toggle works but changes are subtle in video.
