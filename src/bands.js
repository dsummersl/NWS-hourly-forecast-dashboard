import {moonPhaseName} from "./moonsvg.js";

export function moonEmoji(phase) {
  if (phase == null) return "";
  if (phase < 0.0625 || phase >= 0.9375) return "\u{1F311}";
  if (phase < 0.1875) return "\u{1F312}";
  if (phase < 0.3125) return "\u{1F313}";
  if (phase < 0.4375) return "\u{1F314}";
  if (phase < 0.5625) return "\u{1F315}";
  if (phase < 0.6875) return "\u{1F316}";
  if (phase < 0.8125) return "\u{1F317}";
  return "\u{1F318}";
}

export function buildSunLookup(sunEntries, tz) {
  const lookup = new Map();
  if (!sunEntries) return lookup;
  for (const entry of sunEntries) {
    if (!entry.sunrise || !entry.sunset) continue;
    const sr = new Date(entry.sunrise);
    const ss = new Date(entry.sunset);

    const srParts = new Intl.DateTimeFormat("en-US", {timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false}).formatToParts(sr);
    const srHour = parseInt(srParts.find(p => p.type === "hour").value);
    const srMin = parseInt(srParts.find(p => p.type === "minute").value);

    const ssParts = new Intl.DateTimeFormat("en-US", {timeZone: tz, hour: "numeric", minute: "2-digit", hour12: false}).formatToParts(ss);
    const ssHour = parseInt(ssParts.find(p => p.type === "hour").value);
    const ssMin = parseInt(ssParts.find(p => p.type === "minute").value);

    lookup.set(entry.date, {
      srMinutes: srHour * 60 + srMin,
      ssMinutes: ssHour * 60 + ssMin,
    });
  }
  return lookup;
}

export function buildMoonLookup(moonEntries) {
  const lookup = new Map();
  if (!moonEntries) return lookup;
  for (const entry of moonEntries) {
    lookup.set(entry.date, entry);
  }
  return lookup;
}

export function isHourNight(hourStr, sunLookup) {
  const dateStr = hourStr.slice(0, 10);
  const hour = parseInt(hourStr.slice(11, 13));
  const minute = parseInt(hourStr.slice(14, 16));
  const rowMinutes = hour * 60 + minute;

  const s = sunLookup.get(dateStr);
  if (!s) {
    return hour < 6 || hour >= 20;
  }
  return rowMinutes < s.srMinutes || rowMinutes >= s.ssMinutes;
}

export function buildBands(hours, sun, moon, tz) {
  const sunLookup = buildSunLookup(sun, tz);
  const moonLookup = buildMoonLookup(moon);

  const isNight = hours.map(h => isHourNight(h, sunLookup));

  const days = [], nights = [];
  let i = 0;
  while (i < hours.length) {
    const start = new Date(hours[i]);
    let j = i;
    while (j + 1 < hours.length && isNight[j] === isNight[j + 1]) j++;
    const end = new Date(new Date(hours[j]).getTime() + 3600000);
    const band = {start, end};
    if (isNight[i]) {
      const dateStr = hours[i].slice(0, 10);
      const moonData = moonLookup.get(dateStr);
      if (moonData) {
        band.moonPhase = moonData.phase;
        band.moonIllumination = moonData.illumination;
        band.moonName = moonPhaseName(moonData.phase * 360);
      }
      nights.push(band);
    } else {
      days.push(band);
    }
    i = j + 1;
  }
  return {days, nights};
}
