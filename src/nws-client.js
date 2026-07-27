// Runtime NWS API client — ports the Python data loader to the browser
// so users can change location without rebuilding.

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
    if (unit === "mm") value = Math.round(value / 25.4, 2);
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

function jday(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const n = Math.floor(367 * y - 7 * (y + Math.floor((m + 9) / 12)) / 4 + 275 * m / 9 + d - 730531.5);
  return n;
}

function solarEvent(date, lat, lon, rising) {
  const n = jday(date) + 0.0008;
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const Mr = M * Math.PI / 180;
  const C = 1.9148 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
  const lam = (M + C + 180 + 102.9372) % 360;
  const lamr = lam * Math.PI / 180;
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(lamr);
  const decl = Math.asin(Math.sin(lamr) * Math.sin(23.4397 * Math.PI / 180));
  const cosOmega = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * Math.sin(decl)) / (Math.cos(lat * Math.PI / 180) * Math.cos(decl));
  if (cosOmega < -1 || cosOmega > 1) return null;
  const omega = Math.acos(cosOmega) * 180 / Math.PI;
  const jEvent = jTransit + (rising ? -omega : omega) / 360;
  const ms = (jEvent - 2451545) * 86400000 + new Date(Date.UTC(2000, 0, 1, 12)).getTime();
  return new Date(ms);
}

export async function fetchLocationGrid(lat, lon) {
  // NWS API requires coordinates with reasonable precision
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
  // Convert to local wall-clock
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

  const series = {};
  for (const name of elements) {
    if (grid[name]) series[name] = expand(grid[name], hoursUTC, units[name]);
  }

  const weatherGrid = grid.weather?.values || [];
  const weather = expandWeather(weatherGrid, hoursUTC);
  series.weather = weather;

  // Sun times
  const days = [...new Set(hoursLocal.map(d => d.toISOString().slice(0, 10)))].map(s => new Date(s + "T00:00:00"));
  const sun = days.map(day => {
    const entry = {date: day.toISOString().slice(0, 10)};
    const sr = solarEvent(day, lat, lon, true);
    const ss = solarEvent(day, lat, lon, false);
    if (sr) entry.sunrise = sr.toISOString();
    if (ss) entry.sunset = ss.toISOString();
    return entry;
  });

  // Worded periods
  let periods = [];
  try {
    const fc = await get(point.forecast);
    periods = (fc.properties.periods || []).map(p => ({
      name: p.name, isDaytime: p.isDaytime, start: p.startTime,
      temperature: p.temperature, shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
    }));
  } catch (_) {}

  // Active alerts
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
    hours: hoursLocal.map(d => d.toISOString().slice(0, 16)),
    series,
    sun,
    periods,
    alerts,
  };
}
