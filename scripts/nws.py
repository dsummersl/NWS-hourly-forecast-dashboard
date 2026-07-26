#!/usr/bin/env python3
"""
nws.py — the hourly forecast behind forecast.weather.gov's graphical "meteogram" page,
fetched straight from the NWS API instead of scraped off the PNG-generating CGI.

That page (MapClick.php?FcstType=graphical&…) plots the National Digital Forecast
Database (NDFD) grid for one point: temperature, wind chill / heat index, surface wind,
sky cover, precipitation potential, humidity. The same grid is a public JSON API:

    /points/{lat},{lon}                -> which office + grid cell covers the point
    /gridpoints/{office}/{x},{y}       -> every NDFD element for that cell
    /gridpoints/{office}/{x},{y}/forecast -> the worded 7-day periods

The gridpoint payload is *not* a flat hourly table: each element is a list of
`{validTime, value}` where validTime is an ISO 8601 interval like
`2026-07-26T12:00:00+00:00/PT5H` — one entry covering five hours. Elements also have
different breakpoints from each other (temperature hourly, wind speed in 5h blocks).
`expand()` below flattens each element onto a common hourly grid so the page can plot
them against one shared time axis.

Run standalone:
    python scripts/nws.py --lat 36.01 --lon -79.227 --out forecast.json

Requires: requests.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

try:
    import requests
except ImportError:
    sys.exit("Missing deps — run: pip install requests")

API = "https://api.weather.gov"

# NWS asks every client to identify itself; an anonymous UA gets 403s.
UA = os.environ.get("NWS_USER_AGENT", "(agentexperiments nws-forecast-viz, dsummersl@gmail.com)")

HTTP_TOO_MANY_REQUESTS = 429
HTTP_SERVER_ERROR_MIN = 500
DEFAULT_HOURS = 168  # 7 days, the NDFD grid's usable horizon

# NDFD elements the graphical page plots, mapped to the unit the page shows them in.
# "asis" means the API's native unit is already what we want (percent, degrees).
ELEMENTS: dict[str, str] = {
    "temperature": "degF",
    "apparentTemperature": "degF",
    "heatIndex": "degF",
    "windChill": "degF",
    "dewpoint": "degF",
    "relativeHumidity": "asis",
    "skyCover": "asis",
    "probabilityOfPrecipitation": "asis",
    "windSpeed": "mph",
    "windGust": "mph",
    "windDirection": "asis",
    "quantitativePrecipitation": "mm",
}

_DUR = re.compile(
    r"^P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?$"
)


def _get(url: str, *, retries: int = 4) -> dict[str, Any]:
    """GET with backoff. NWS returns 500s under load and 429s if you hammer it."""
    headers = {"User-Agent": UA, "Accept": "application/geo+json"}
    delay = 1.0
    for attempt in range(retries + 1):
        r = requests.get(url, headers=headers, timeout=60)
        retryable = r.status_code >= HTTP_SERVER_ERROR_MIN or r.status_code == HTTP_TOO_MANY_REQUESTS
        if not retryable or attempt == retries:
            r.raise_for_status()
            return r.json()
        time.sleep(delay)
        delay *= 2
    raise RuntimeError("unreachable")


def parse_duration(text: str) -> timedelta:
    """ISO 8601 duration -> timedelta. NDFD only ever uses days/hours/minutes."""
    m = _DUR.match(text)
    if not m:
        raise ValueError(f"unsupported ISO 8601 duration: {text!r}")
    parts = {k: int(v) for k, v in m.groupdict().items() if v}
    return timedelta(**parts) if parts else timedelta(0)


def parse_interval(text: str) -> tuple[datetime, timedelta]:
    start_text, _, dur_text = text.partition("/")
    return datetime.fromisoformat(start_text), parse_duration(dur_text)


def convert(value: float | None, unit: str) -> float | None:
    if value is None:
        return None
    if unit == "degF":
        return round(value * 9 / 5 + 32, 1)
    if unit == "mph":
        return round(value * 0.621371, 1)
    if unit == "mm":
        return round(value / 25.4, 2)
    return round(value, 1)


def expand(element: dict[str, Any], hours: list[datetime], unit: str) -> list[float | None]:
    """Flatten one NDFD element's interval-coded values onto the shared hourly grid."""
    out: list[float | None] = [None] * len(hours)
    index = {h: i for i, h in enumerate(hours)}
    for entry in element.get("values", []):
        start, duration = parse_interval(entry["validTime"])
        value = convert(entry.get("value"), unit)
        if value is None:
            continue
        # Round the interval start down to the hour it lands in, then fill forward.
        cursor = start.replace(minute=0, second=0, microsecond=0)
        end = start + duration
        while cursor < end:
            i = index.get(cursor)
            if i is not None:
                out[i] = value
            cursor += timedelta(hours=1)
    return out


# Weather coverage levels mapped to a 0-4 ordinal scale.
# Rain/thunder: SCHC (1), CHC (2), LKLY (3), OCNL (4)
# Fog: Isolated (1), Patchy (2), Areas (3), WdSprd (4)
WEATHER_COVERAGE: dict[str, int] = {
    "none": 0,
    "slight_chance": 1,
    "isolated": 1,
    "patchy": 2,
    "chance": 2,
    "areas": 3,
    "likely": 3,
    "numerous": 3,
    "occasional": 4,
    "widespread": 4,
    "definite": 4,
}

# Map weather types to display groups
WEATHER_GROUPS: dict[str, str] = {
    "rain": "rain",
    "rain_showers": "rain",
    "rain_snow": "rain",
    "thunderstorms": "thunder",
    "fog": "fog",
    "fog_mist": "fog",
    "haze": "fog",
    "smoke": "fog",
}


def expand_weather(
    values: list[dict], hours: list[datetime]
) -> dict[str, list[int]]:
    """Expand the NDFD weather element onto the shared hourly grid.

    Returns {rain: [...], thunder: [...], fog: [...]} where each value
    is a 0-4 coverage level per hour.
    """
    out: dict[str, list[int]] = {
        "rain": [0] * len(hours),
        "thunder": [0] * len(hours),
        "fog": [0] * len(hours),
    }
    index = {h: i for i, h in enumerate(hours)}
    for entry in values:
        start, duration = parse_interval(entry["validTime"])
        cursor = start.replace(minute=0, second=0, microsecond=0)
        end = start + duration
        conditions = entry.get("value", [])
        if not conditions or conditions[0].get("weather") is None:
            continue
        for cond in conditions:
            wt = cond.get("weather")
            group = WEATHER_GROUPS.get(wt) if wt else None
            if group is None:
                continue
            cov = cond.get("coverage") or "none"
            level = WEATHER_COVERAGE.get(cov, 0)
            while cursor < end:
                i = index.get(cursor)
                if i is not None:
                    out[group][i] = max(out[group][i], level)
                cursor += timedelta(hours=1)
    return out


J2000 = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)  # JD 2451545.0 is noon, not midnight


def _solar_event(day: date, lat: float, lon: float, *, rising: bool) -> datetime | None:
    """Sunrise/sunset as an absolute UTC instant, via the NOAA low-precision almanac (±1 min).

    Only used to shade the night bands behind the meteogram, so almanac precision is
    plenty and it keeps the loader dependency-free beyond requests.
    """
    n = day.toordinal() - date(2000, 1, 1).toordinal() + 0.0008
    j_star = n - lon / 360.0
    m = math.radians((357.5291 + 0.98560028 * j_star) % 360)
    c = 1.9148 * math.sin(m) + 0.02 * math.sin(2 * m) + 0.0003 * math.sin(3 * m)
    lam = math.radians((math.degrees(m) + c + 180 + 102.9372) % 360)
    j_transit = 2451545.0 + j_star + 0.0053 * math.sin(m) - 0.0069 * math.sin(2 * lam)
    decl = math.asin(math.sin(lam) * math.sin(math.radians(23.4397)))
    cos_omega = (
        math.sin(math.radians(-0.833)) - math.sin(math.radians(lat)) * math.sin(decl)
    ) / (math.cos(math.radians(lat)) * math.cos(decl))
    if not -1 <= cos_omega <= 1:
        return None  # polar day/night — no event this date
    omega = math.degrees(math.acos(cos_omega))
    j_event = j_transit + (omega if rising is False else -omega) / 360.0
    return J2000 + timedelta(days=j_event - 2451545.0)


def sun_times(days: list[date], lat: float, lon: float, tz: ZoneInfo) -> list[dict[str, str]]:
    out = []
    for day in days:
        entry: dict[str, str] = {"date": day.isoformat()}
        for key, rising in (("sunrise", True), ("sunset", False)):
            moment = _solar_event(day, lat, lon, rising=rising)
            if moment is None:
                continue
            entry[key] = moment.astimezone(tz).replace(tzinfo=None).isoformat(timespec="minutes")
        out.append(entry)
    return out


def build(lat: float, lon: float, horizon_hours: int = DEFAULT_HOURS) -> dict[str, Any]:
    point = _get(f"{API}/points/{lat},{lon}")["properties"]
    tz = ZoneInfo(point["timeZone"])
    grid = _get(point["forecastGridData"])["properties"]

    # Every timestamp the page sees is *naive local* wall-clock text: `new Date("…T08:00")`
    # in the browser reads it back as the same wall clock, so a forecast for 8am in
    # Raleigh plots at 8am regardless of where the reader's browser sits.
    start, _ = parse_interval(grid["validTimes"])
    start = start.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    hours_local = [start + timedelta(hours=i) for i in range(horizon_hours)]
    hours_utc = [h.astimezone(timezone.utc) for h in hours_local]

    series = {
        name: expand(grid[name], hours_utc, unit)
        for name, unit in ELEMENTS.items()
        if name in grid
    }

    loc = point["relativeLocation"]["properties"]
    elevation_m = grid.get("elevation", {}).get("value")
    days = sorted({h.date() for h in hours_local})

    weather_grid = grid.get("weather", {}).get("values", [])
    series["weather"] = expand_weather(weather_grid, hours_utc)

    return {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "updated": grid.get("updateTime"),
        "location": {
            "lat": lat,
            "lon": lon,
            "city": loc.get("city"),
            "state": loc.get("state"),
            "timeZone": point["timeZone"],
            "office": point["gridId"],
            "gridX": point["gridX"],
            "gridY": point["gridY"],
            "elevation_ft": round(elevation_m * 3.28084) if elevation_m is not None else None,
            "forecastOfficeUrl": point.get("forecastOffice"),
        },
        "hours": [h.replace(tzinfo=None).isoformat(timespec="minutes") for h in hours_local],
        "series": series,
        "sun": sun_times(days, lat, lon, tz),
        "periods": worded_periods(point["forecast"]),
    }


def worded_periods(url: str) -> list[dict[str, Any]]:
    """The plain-English 7-day forecast, for the summary card above the meteogram."""
    periods = _get(url)["properties"]["periods"]
    return [
        {
            "name": p["name"],
            "isDaytime": p["isDaytime"],
            "start": p["startTime"],
            "temperature": p["temperature"],
            "shortForecast": p["shortForecast"],
            "detailedForecast": p["detailedForecast"],
        }
        for p in periods
    ]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--lat", type=float, default=float(os.environ.get("NWS_LAT", 36.01)))
    ap.add_argument("--lon", type=float, default=float(os.environ.get("NWS_LON", -79.227)))
    ap.add_argument("--hours", type=int, default=DEFAULT_HOURS)
    ap.add_argument("--out", help="write here instead of stdout")
    args = ap.parse_args()

    data = build(args.lat, args.lon, args.hours)
    text = json.dumps(data, indent=2)
    if args.out:
        with open(args.out, "w") as fh:
            fh.write(text)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
