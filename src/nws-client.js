import {Observer, SearchRiseSet, Illumination, MoonPhase, Body, MakeTime} from "astronomy-engine";

const API = "https://api.weather.gov";
const UA = "(agentexperiments nws-forecast-viz, dsummersl@gmail.com)";

async function get(url) {
  const r = await fetch(url, {
    headers: {"User-Agent": UA, Accept: "application/geo+json"},
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    let detail = "";
    try { detail = JSON.parse(body).detail || ""; } catch (_) {}
    throw new Error(detail.includes("InvalidPoint")
      ? "Location is outside NWS coverage area (US only)"
      : `NWS API ${r.status}: ${detail || body.slice(0, 200)}`);
  }
  return r.json();
}

function parseDuration(text) {
  const m = text.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!m) throw new Error(`bad duration: ${text}`);
  return ((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60) * 1000;
}

function expand(element, hours, unit) {
  const out = new Array(hours.length).fill(null);
  const index = new Map(hours.map((h, i) => [h.getTime(), i]));
  for (const entry of element.values || []) {
    const [startText, durText] = entry.validTime.split("/");
    const start = new Date(startText);
    const duration = parseDuration(durText);
    let value = entry.value;
    if (value == null) continue;
    if (unit === "degF") value = Math.round(value * 9 / 5 + 32, 1);
    if (unit === "mph") value = Math.round(value * 0.621371, 1);
    if (unit === "mm") value = Math.round(value / 25.4 * 100) / 100;
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + duration);
    while (cursor < end) {
      const i = index.get(cursor.getTime());
      if (i != null) out[i] = value;
      cursor.setHours(cursor.getHours() + 1);
    }
  }
  return out;
}

const WEATHER_COVERAGE = {
  none: 0, slight_chance: 1, isolated: 1, patchy: 2, chance: 2,
  areas: 3, likely: 3, numerous: 3, occasional: 4, widespread: 4, definite: 4,
};
const WEATHER_GROUPS = {
  rain: "rain", rain_showers: "rain", rain_snow: "rain",
  thunderstorms: "thunder", fog: "fog", fog_mist: "fog", haze: "fog", smoke: "fog",
};

function expandWeather(values, hours) {
  const out = {rain: new Array(hours.length).fill(0), thunder: new Array(hours.length).fill(0), fog: new Array(hours.length).fill(0)};
  const index = new Map(hours.map((h, i) => [h.getTime(), i]));
  for (const entry of values || []) {
    const [startText, durText] = entry.validTime.split("/");
    const start = new Date(startText);
    const duration = parseDuration(durText);
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + duration);
    const conditions = entry.value || [];
    if (!conditions.length || conditions[0].weather == null) continue;
    for (const cond of conditions) {
      const group = WEATHER_GROUPS[cond.weather];
      if (!group) continue;
      const level = WEATHER_COVERAGE[cond.coverage || "none"] || 0;
      const ci = cursor.getTime();
      const ei = end.getTime();
      let t = ci;
      while (t < ei) {
        const i = index.get(t);
        if (i != null) out[group][i] = Math.max(out[group][i], level);
        t += 3600000;
      }
    }
  }
  return out;
}

export function moonPhaseName(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (a < 22.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Last Quarter";
  if (a < 337.5) return "Waning Crescent";
  return "New Moon";
}

export async function fetchLocationGrid(lat, lon) {
  const slat = Number(lat).toFixed(4);
  const slon = Number(lon).toFixed(4);
  const point = await get(`${API}/points/${slat},${slon}`);
  const props = point.properties;
  const grid = await get(props.forecastGridData);
  return {point: props, grid: grid.properties};
}

export async function fetchForecast(lat, lon, hours = 168) {
  const {point, grid} = await fetchLocationGrid(lat, lon);

  const tz = point.timeZone;
  const start = new Date(grid.validTimes.split("/")[0]);
  const startLocal = new Date(start.toLocaleString("en-US", {timeZone: tz}));
  startLocal.setMinutes(0, 0, 0);

  const elements = [
    "temperature", "apparentTemperature", "heatIndex", "windChill",
    "dewpoint", "relativeHumidity", "skyCover", "probabilityOfPrecipitation",
    "windSpeed", "windGust", "windDirection", "quantitativePrecipitation",
  ];
  const units = {
    temperature: "degF", apparentTemperature: "degF", heatIndex: "degF",
    windChill: "degF", dewpoint: "degF", relativeHumidity: "asis",
    skyCover: "asis", probabilityOfPrecipitation: "asis",
    windSpeed: "mph", windGust: "mph", windDirection: "asis",
    quantitativePrecipitation: "mm",
  };

  const hoursLocal = Array.from({length: hours}, (_, i) => new Date(startLocal.getTime() + i * 3600000));
  const hoursUTC = hoursLocal.map(d => new Date(d.toLocaleString("en-US", {timeZone: "UTC"})));

  const fmtLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${dd}T${hh}:${mm}`;
  };

  const series = {};
  for (const name of elements) {
    if (grid[name]) series[name] = expand(grid[name], hoursUTC, units[name]);
  }

  const weatherGrid = grid.weather?.values || [];
  const weather = expandWeather(weatherGrid, hoursUTC);
  series.weather = weather;

  const localDates = [...new Set(hoursLocal.map(fmtLocal).map(s => s.slice(0, 10)))];
  const observer = new Observer(lat, lon, 0);

  const sun = localDates.map(dateStr => {
    const entry = {date: dateStr};
    const startTime = MakeTime(new Date(dateStr + "T00:00:00Z"));
    const sr = SearchRiseSet(Body.Sun, observer, +1, startTime, 2);
    const ss = SearchRiseSet(Body.Sun, observer, -1, startTime, 2);
    if (sr) entry.sunrise = sr.date.toISOString();
    if (ss) entry.sunset = ss.date.toISOString();
    return entry;
  });

  const moon = localDates.map(dateStr => {
    const time = MakeTime(new Date(dateStr + "T12:00:00Z"));
    const illum = Illumination(Body.Moon, time);
    const angle = MoonPhase(time);
    const phase = ((angle % 360) + 360) % 360 / 360;
    return {
      date: dateStr,
      phase,
      illumination: illum.phase_fraction,
      name: moonPhaseName(angle),
    };
  });

  let periods = [];
  try {
    const fc = await get(point.forecast);
    periods = (fc.properties.periods || []).map(p => ({
      name: p.name, isDaytime: p.isDaytime, start: p.startTime,
      temperature: p.temperature, shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
    }));
  } catch (_) {}

  let alerts = [];
  try {
    const alertRes = await get(`${API}/alerts/active?point=${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`);
    alerts = (alertRes.features || []).map(f => ({
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      description: f.properties.description,
      instruction: f.properties.instruction,
    }));
  } catch (_) {}

  const loc = point.relativeLocation.properties;
  return {
    generated: new Date().toISOString(),
    updated: grid.updateTime,
    location: {
      lat, lon,
      city: loc.city, state: loc.state,
      timeZone: tz, office: point.gridId,
      gridX: point.gridX, gridY: point.gridY,
      elevation_ft: grid.elevation?.value ? Math.round(grid.elevation.value * 3.28084) : null,
    },
    hours: hoursLocal.map(fmtLocal),
    series,
    sun,
    moon,
    periods,
    alerts,
  };
}
