import {describe, it, expect} from "vitest";
import {SearchRiseSet, Illumination, MoonPhase, Body, Observer, MakeTime} from "astronomy-engine";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {moonEmoji, buildSunLookup, isHourNight, buildBands} from "../src/bands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf-8"));
}

describe("moonEmoji", () => {
  it("new moon at phase 0", () => expect(moonEmoji(0)).toBe("\u{1F311}"));
  it("new moon at phase 0.05", () => expect(moonEmoji(0.05)).toBe("\u{1F311}"));
  it("new moon at phase 0.95", () => expect(moonEmoji(0.95)).toBe("\u{1F311}"));
  it("waxing crescent at 0.125", () => expect(moonEmoji(0.125)).toBe("\u{1F312}"));
  it("first quarter at 0.25", () => expect(moonEmoji(0.25)).toBe("\u{1F313}"));
  it("waxing gibbous at 0.375", () => expect(moonEmoji(0.375)).toBe("\u{1F314}"));
  it("full moon at 0.5", () => expect(moonEmoji(0.5)).toBe("\u{1F315}"));
  it("waning gibbous at 0.625", () => expect(moonEmoji(0.625)).toBe("\u{1F316}"));
  it("last quarter at 0.75", () => expect(moonEmoji(0.75)).toBe("\u{1F317}"));
  it("waning crescent at 0.875", () => expect(moonEmoji(0.875)).toBe("\u{1F318}"));
  it("null returns empty string", () => expect(moonEmoji(null)).toBe(""));
  it("undefined returns empty string", () => expect(moonEmoji(undefined)).toBe(""));
});

describe("buildSunLookup", () => {
  it("converts UTC sunrise/sunset to EDT wall-clock minutes", () => {
    const sun = [
      {date: "2026-07-27", sunrise: "2026-07-27T10:20:00Z", sunset: "2026-07-28T00:25:00Z"},
    ];
    const lookup = buildSunLookup(sun, "America/New_York");
    const entry = lookup.get("2026-07-27");
    expect(entry.srMinutes).toBe(6 * 60 + 20);
    expect(entry.ssMinutes).toBe(20 * 60 + 25);
  });

  it("skips entries without sunrise or sunset", () => {
    const sun = [
      {date: "2026-07-27"},
      {date: "2026-07-28", sunrise: "2026-07-28T10:21:00Z", sunset: "2026-07-29T00:24:00Z"},
    ];
    const lookup = buildSunLookup(sun, "America/New_York");
    expect(lookup.has("2026-07-27")).toBe(false);
    expect(lookup.has("2026-07-28")).toBe(true);
  });

  it("handles null/undefined sunEntries", () => {
    expect(buildSunLookup(null, "UTC").size).toBe(0);
    expect(buildSunLookup(undefined, "UTC").size).toBe(0);
  });

  it("handles Pacific timezone correctly", () => {
    const sun = [
      {date: "2026-07-27", sunrise: "2026-07-27T13:00:00Z", sunset: "2026-07-28T03:00:00Z"},
    ];
    const lookup = buildSunLookup(sun, "America/Los_Angeles");
    const entry = lookup.get("2026-07-27");
    expect(entry.srMinutes).toBe(6 * 60);
    expect(entry.ssMinutes).toBe(20 * 60);
  });
});

describe("isHourNight", () => {
  let sunLookup;

  beforeEach(() => {
    sunLookup = buildSunLookup([
      {date: "2026-07-27", sunrise: "2026-07-27T10:20:00Z", sunset: "2026-07-28T00:25:00Z"},
      {date: "2026-07-28", sunrise: "2026-07-28T10:21:00Z", sunset: "2026-07-29T00:24:00Z"},
    ], "America/New_York");
  });

  it("night at 2 AM", () => {
    expect(isHourNight("2026-07-27T02:00:00", sunLookup)).toBe(true);
  });

  it("night just before sunrise (6:00 AM)", () => {
    expect(isHourNight("2026-07-27T06:00:00", sunLookup)).toBe(true);
  });

  it("day after sunrise (7:00 AM)", () => {
    expect(isHourNight("2026-07-27T07:00:00", sunLookup)).toBe(false);
  });

  it("day at noon", () => {
    expect(isHourNight("2026-07-27T12:00:00", sunLookup)).toBe(false);
  });

  it("day just before sunset (8:00 PM)", () => {
    expect(isHourNight("2026-07-27T20:00:00", sunLookup)).toBe(false);
  });

  it("night at exact sunset minute (8:25 PM)", () => {
    expect(isHourNight("2026-07-27T20:25:00", sunLookup)).toBe(true);
  });

  it("night after sunset (10:00 PM)", () => {
    expect(isHourNight("2026-07-27T22:00:00", sunLookup)).toBe(true);
  });

  it("night at midnight — uses current date, not next day", () => {
    expect(isHourNight("2026-07-28T00:00:00", sunLookup)).toBe(true);
  });

  it("night at 4 AM next day", () => {
    expect(isHourNight("2026-07-28T04:00:00", sunLookup)).toBe(true);
  });

  it("day at 8 AM next day", () => {
    expect(isHourNight("2026-07-28T08:00:00", sunLookup)).toBe(false);
  });

  it("falls back to heuristic when sun lookup is empty", () => {
    const empty = new Map();
    expect(isHourNight("2026-07-27T02:00:00", empty)).toBe(true);
    expect(isHourNight("2026-07-27T10:00:00", empty)).toBe(false);
    expect(isHourNight("2026-07-27T22:00:00", empty)).toBe(true);
  });

  it("heuristic: 5 AM is night, 6 AM is day, 7 PM is day, 8 PM is night", () => {
    const empty = new Map();
    expect(isHourNight("2026-07-27T05:00:00", empty)).toBe(true);
    expect(isHourNight("2026-07-27T06:00:00", empty)).toBe(false);
    expect(isHourNight("2026-07-27T19:00:00", empty)).toBe(false);
    expect(isHourNight("2026-07-27T20:00:00", empty)).toBe(true);
  });
});

describe("buildBands", () => {
  const sun = [
    {date: "2026-07-27", sunrise: "2026-07-27T10:20:00Z", sunset: "2026-07-28T00:25:00Z"},
    {date: "2026-07-28", sunrise: "2026-07-28T10:21:00Z", sunset: "2026-07-29T00:24:00Z"},
  ];
  const moon = [
    {date: "2026-07-27", phase: 0.42, illumination: 0.94},
    {date: "2026-07-28", phase: 0.43, illumination: 0.95},
  ];
  const tz = "America/New_York";

  function makeHours(startDay, startHour, count) {
    const hours = [];
    for (let i = 0; i < count; i++) {
      const totalHours = startHour + i;
      const day = startDay + Math.floor(totalHours / 24);
      const h = String(totalHours % 24).padStart(2, "0");
      hours.push(`2026-07-${String(day).padStart(2, "0")}T${h}:00:00`);
    }
    return hours;
  }

  it("produces alternating day/night bands for 48h", () => {
    const hours = makeHours(27, 0, 48);
    const {days, nights} = buildBands(hours, sun, moon, tz);

    expect(days.length).toBeGreaterThan(0);
    expect(nights.length).toBeGreaterThan(0);

    const day1 = days[0];
    // end is one hour past the last day hour, so subtract 1h for the last actual hour
    const lastDayHour = new Date(day1.end.getTime() - 3600000);
    // sunset is at 20:25, so hour 20 (8:00 PM) is the last day hour
    expect(lastDayHour.getHours()).toBe(20);

    const night1 = nights[0];
    expect(night1.moonPhase).toBe(0.42);
    expect(night1.moonIllumination).toBe(0.94);
    expect(night1.moonName).toBe("Waxing Gibbous");
  });

  it("attaches moon data to night bands", () => {
    const hours = makeHours(27, 2, 10);
    const {nights} = buildBands(hours, sun, moon, tz);
    const nightWithMoon = nights.find(n => n.moonPhase != null);
    expect(nightWithMoon).toBeDefined();
    expect(nightWithMoon.moonPhase).toBe(0.42);
  });

  it("handles polar day (no sunset)", () => {
    const hours = ["2026-06-21T10:00:00", "2026-06-21T14:00:00"];
    const polarSun = [{date: "2026-06-21"}];
    const {nights} = buildBands(hours, polarSun, null, "UTC");
    expect(nights.length).toBe(0);
  });

  it("handles empty hours array", () => {
    const {days, nights} = buildBands([], sun, moon, tz);
    expect(days.length).toBe(0);
    expect(nights.length).toBe(0);
  });
});

describe("integration: real NWS fixture + astronomy-engine", () => {
  it("all hours between sunrise and sunset are classified as day", () => {
    const grid = loadFixture("grid-data.json");
    const lat = 36.0754, lon = -79.0994, tz = "America/New_York";

    const start = new Date(grid.validTimes.split("/")[0]);
    const startLocal = new Date(start.toLocaleString("en-US", {timeZone: tz}));
    startLocal.setMinutes(0, 0, 0);

    const fmtLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${dd}T${hh}:${mm}`;
    };

    const hoursLocal = Array.from({length: 168}, (_, i) =>
      new Date(startLocal.getTime() + i * 3600000)
    );
    const hours = hoursLocal.map(fmtLocal);
    const localDates = [...new Set(hours.map(s => s.slice(0, 10)))];

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
      return {date: dateStr, phase, illumination: illum.phase_fraction};
    });

    const {days, nights} = buildBands(hours, sun, moon, tz);
    const sunLookup = buildSunLookup(sun, tz);

    expect(days.length).toBeGreaterThan(0);
    expect(nights.length).toBeGreaterThan(0);

    for (const h of hours) {
      const dateStr = h.slice(0, 10);
      const hour = parseInt(h.slice(11, 13));
      const entry = sunLookup.get(dateStr);
      if (entry) {
        const minutes = hour * 60;
        if (minutes >= entry.srMinutes && minutes < entry.ssMinutes) {
          expect(isHourNight(h, sunLookup)).toBe(false);
        }
      }
    }
  });

  it("produces valid moon data for each forecast date", () => {
    const grid = loadFixture("grid-data.json");
    const tz = "America/New_York";

    const start = new Date(grid.validTimes.split("/")[0]);
    const startLocal = new Date(start.toLocaleString("en-US", {timeZone: tz}));
    startLocal.setMinutes(0, 0, 0);

    const fmtLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${dd}T${hh}:${mm}`;
    };

    const hoursLocal = Array.from({length: 168}, (_, i) =>
      new Date(startLocal.getTime() + i * 3600000)
    );
    const hours = hoursLocal.map(fmtLocal);
    const localDates = [...new Set(hours.map(s => s.slice(0, 10)))];

    for (const dateStr of localDates) {
      const time = MakeTime(new Date(dateStr + "T12:00:00Z"));
      const illum = Illumination(Body.Moon, time);
      const angle = MoonPhase(time);
      const phase = ((angle % 360) + 360) % 360 / 360;

      expect(illum.phase_fraction).toBeGreaterThanOrEqual(0);
      expect(illum.phase_fraction).toBeLessThanOrEqual(1);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
      // Verify moonEmoji doesn't throw for valid phase
      expect(typeof moonEmoji(phase)).toBe("string");
      expect(moonEmoji(phase).length).toBeGreaterThan(0);
    }
  });
});
