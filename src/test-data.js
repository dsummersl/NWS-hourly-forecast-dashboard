import {Observer, SearchRiseSet, Body, MakeTime, Illumination, MoonPhase} from "astronomy-engine";
import {moonPhaseName} from "./nws-client.js";

const SPECS = {
  temperature:              {low: 20,  mid: 65,  high: 105, period: 6},
  apparentTemperature:      {low: 15,  mid: 65,  high: 110, period: 7},
  heatIndex:                {low: 60,  mid: 90,  high: 115, period: 8},
  windChill:                {low: -10, mid: 30,  high: 55,  period: 5},
  dewpoint:                 {low: 10,  mid: 50,  high: 75,  period: 9},
  relativeHumidity:         {low: 15,  mid: 55,  high: 95,  period: 10},
  skyCover:                 {low: 5,   mid: 50,  high: 95,  period: 11},
  probabilityOfPrecipitation: {low: 5, mid: 50, high: 95, period: 12},
  windSpeed:                {low: 0,   mid: 15,  high: 35,  period: 13},
  windGust:                 {low: 0,   mid: 25,  high: 50,  period: 14},
  windDirection:            {low: 0,   mid: 180, high: 350, period: 15},
  quantitativePrecipitation: {low: 0,  mid: 0.5, high: 2.0, period: 16, decimals: 2},
  "weather.rain":           {low: 0,   mid: 2,   high: 4,   period: 17, integer: true},
  "weather.thunder":        {low: 0,   mid: 1,   high: 3,   period: 18, integer: true},
  "weather.fog":            {low: 0,   mid: 1,   high: 3,   period: 19, integer: true},
};

function cycleValue(spec, i) {
  const p = spec.period;
  const segment = Math.floor(((i % p) / p) * 3);
  const vals = [spec.low, spec.mid, spec.high];
  let v = vals[segment];
  if (spec.decimals != null) v = parseFloat(v.toFixed(spec.decimals));
  if (spec.integer) v = Math.round(v);
  return v;
}

export function generateTestData(lat = 36.01, lon = -79.227, hours = 168) {
  const tz = "America/New_York";
  const now = new Date();
  const start = new Date(now.toLocaleString("en-US", {timeZone: tz}));
  start.setMinutes(0, 0, 0);

  const fmtLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    return `${y}-${m}-${dd}T${hh}:00`;
  };

  const hoursLocal = Array.from({length: hours}, (_, i) => new Date(start.getTime() + i * 3600000));
  const hoursArr = hoursLocal.map(fmtLocal);

  const series = {};
  for (const [key, spec] of Object.entries(SPECS)) {
    const arr = new Array(hours).fill(null);
    for (let i = 0; i < hours; i++) {
      arr[i] = cycleValue(spec, i);
    }
    if (key.startsWith("weather.")) {
      series.weather = series.weather || {};
      series.weather[key.replace("weather.", "")] = arr;
    } else {
      series[key] = arr;
    }
  }

  const localDates = [...new Set(hoursLocal.map(d => fmtLocal(d).slice(0, 10)))];
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

  const periods = [];
  const isos = hoursLocal.map(d => d.toISOString());
  for (let day = 0; day < Math.ceil(hours / 24); day++) {
    periods.push({
      name: day === 0 ? "Today" : `Day ${day + 1}`,
      isDaytime: true,
      start: isos[day * 24],
      temperature: series.temperature[day * 12],
      shortForecast: `Test day ${day + 1}: mix of conditions`,
      detailedForecast: `Test detailed forecast for day ${day + 1}. Temperature range ${series.temperature[day * 24]}–${series.temperature[Math.min(day * 24 + 11, hours - 1)]}°F with varying cloud cover, wind, and precipitation.`,
    });
    periods.push({
      name: day === 0 ? "Tonight" : `Night ${day + 1}`,
      isDaytime: false,
      start: isos[day * 24 + 12] || isos[isos.length - 1],
      temperature: series.temperature[day * 24 + 18] || series.temperature[series.temperature.length - 1],
      shortForecast: `Test night ${day + 1}: mixed conditions`,
      detailedForecast: `Test detailed night forecast for day ${day + 1}. Temperature around ${series.temperature[day * 24 + 18] || "—"}°F with varying sky cover and possible precipitation.`,
    });
  }

  return {
    generated: new Date().toISOString(),
    updated: new Date().toISOString(),
    location: {
      lat,
      lon,
      city: "Testville",
      state: "XX",
      timeZone: tz,
      office: "TST",
      gridX: 0,
      gridY: 0,
      elevation_ft: 500,
    },
    hours: hoursArr,
    series,
    sun,
    moon,
    periods,
    alerts: [],
  };
}