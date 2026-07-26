# Notes

Working log for rebuilding the NWS graphical forecast page as an Observable Framework
app, modeled on `well-viz-real-data/` in this repo.

## The starting URL

```
forecast.weather.gov/MapClick.php?w0=t&w2=wc&w3=sfcwind&w3u=1&w4=sky&…
  &FcstType=graphical&textField1=36.01&textField2=-79.227&unit=0
```

Fetched it. It's the NWS point forecast for "5 Miles SW Efland NC" (36.01N 79.23W,
728 ft), and the `w*` params are the meteogram's checkbox state: `w0=t` temperature,
`w2=wc` wind chill, `w3=sfcwind` surface wind, `w4=sky` sky cover. The page renders
**server-side PNGs** from a CGI script — there are no numbers in the HTML to scrape.

But the page itself names its source: NDFD, the National Digital Forecast Database,
"accessed through digital.weather.gov". That's a public JSON API. So: don't scrape the
page, go to the grid it's drawing.

## Confirming the API path

```
/points/36.01,-79.227  →  office RAH, grid 52,65, tz America/New_York,
                          relativeLocation Mebane NC, forecastGridData URL
/gridpoints/RAH/52,65  →  59 elements
```

All four of the page's parameters are there, plus everything in its other tabs (fire
weather: mixing height, transport wind, dispersion index; aviation: ceiling, visibility).
Took 11 elements: temperature, apparentTemperature, heatIndex, windChill, dewpoint,
relativeHumidity, skyCover, probabilityOfPrecipitation, windSpeed, windGust,
windDirection.

## Wrinkle 1: it is not an hourly table

Each element is a list of `{validTime, value}` where validTime is an ISO 8601 *interval*:

```
temperature   147 entries   "2026-07-26T12:00:00+00:00/PT1H"
windSpeed      66 entries   "2026-07-26T12:00:00+00:00/PT5H"   ← 5 hours, one entry
windGust       91 entries   ".../PT3H"
windChill       1 entry     ".../P7DT13H", value null           ← summer
```

Elements break at different points from each other, so nothing lines up until you
flatten it. `expand()` rounds each interval start down to its hour and fills forward to
`start + duration` on a shared 168-hour grid. Needed an ISO-8601 duration parser
(`PnDTnHnMnS`); NDFD only ever uses days/hours in practice but the regex covers M/S.

Also: the API answers in `degC` and `km_h-1` no matter what `unit=` said on the web
page. Converted to °F / mph in the loader.

## Wrinkle 2: timezones

A forecast is inherently local — "8am Monday" means 8am *where the weather is*. Emitting
UTC and formatting in the browser shifts the whole diurnal cycle for anyone reading from
another timezone, which is exactly the thing the chart is about.

Settled on: loader emits **naive local wall-clock strings** (`2026-07-26T08:00`) in the
forecast's own timezone. `new Date("2026-07-26T08:00")` (no offset, ES2015+) parses as
browser-local, so the clock time survives the round trip and every local formatter and
`d3.timeHour` tick agrees. This means the Plot x scale must be `type: "time"`, not
`"utc"` — had it as `utc` at first, which mixed a UTC scale with local tick generation.

## Wrinkle 3: no sunrise/sunset in the API

Wanted night bands behind the panels — they make the diurnal cycle legible and mark day
boundaries without a label on every hour. The NWS API doesn't serve solar times, and I
didn't want to add a dependency for it, so: NOAA low-precision almanac, ~35 lines.

Got it wrong the first time — returned "hours UTC mod 24" and added that to midnight of
the requested date, which put every *sunset* on the previous day (July 26 sunset came
back as `2026-07-25T20:28`) because sunset here falls after 00:00 UTC. Fixed by
returning an absolute instant from the Julian date instead of a time-of-day. Verified:

| | sunrise | sunset |
|---|---|---|
| Jul 26 | 06:20 EDT | 20:28 EDT |
| Dec 21 | 07:24 EST | 17:07 EST |

Both match reality for that latitude.

## Chart decisions

- **One measure per panel, one y scale each.** Temperature/dewpoint share a panel
  because they share units and the *gap between them* is the interesting quantity
  (mugginess). Sky cover, precip chance, and wind each get their own. No dual axes.
- **"Feels like" only where it differs.** `apparentTemperature` equals `temperature`
  most of the time, so plotting it whole gives a second line hugging the first. Drawn
  only where |apparent − temp| ≥ 1°F, which makes it appear exactly on the afternoons
  where the heat index actually bites. `windChill` is all-null in July, which is why
  the series reads from `apparentTemperature` rather than the two components.
- **Colors in CSS variables, not JS.** First pass sniffed dark mode with
  `getComputedStyle(body).colorScheme` — Framework reports `light dark`, so the check
  was always false and dark mode got the light palette. Moved the four hues into custom
  properties with `prefers-color-scheme` + `[data-theme]` scopes; the theme toggle now
  repaints with no JS involved.
- **Palette validated, not eyeballed.** Ran the categorical validator: orange/blue/aqua
  passes all-pairs in both modes; orange + magenta and blue + violet both failed the
  normal-vision floor, so the temperature panel is orange/blue/aqua and magenta is
  reserved for gusts (against blue, which passes).
- **Range selector thins glyphs, not series.** 7 days at hourly resolution is 168
  points: fine for lines, far too dense for wind barbs and precip bars, so those sample
  every N hours. Color stays bound to *which quantity*, so switching range never
  repaints a series.

## Verification

- Loader run live: 168 hourly steps, 11 elements, `windChill` legitimately empty.
- `npm run build` clean; rendered with Playwright in light and dark mode, no console
  errors, all three time ranges exercised, crosshair tooltip checked.
