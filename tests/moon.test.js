import {describe, it, expect} from "vitest";
import {SearchRiseSet, Illumination, MoonPhase, Body, Observer, MakeTime} from "astronomy-engine";
import {moonPhaseName} from "../src/nws-client.js";

describe("moonPhaseName", () => {
  it("returns New Moon for angle 0", () => {
    expect(moonPhaseName(0)).toBe("New Moon");
  });

  it("returns New Moon for angle 350 (close to new)", () => {
    expect(moonPhaseName(350)).toBe("New Moon");
  });

  it("returns New Moon for angle 10 (close to new)", () => {
    expect(moonPhaseName(10)).toBe("New Moon");
  });

  it("returns Waxing Crescent for angle 45", () => {
    expect(moonPhaseName(45)).toBe("Waxing Crescent");
  });

  it("returns First Quarter for angle 90", () => {
    expect(moonPhaseName(90)).toBe("First Quarter");
  });

  it("returns Waxing Gibbous for angle 135", () => {
    expect(moonPhaseName(135)).toBe("Waxing Gibbous");
  });

  it("returns Full Moon for angle 180", () => {
    expect(moonPhaseName(180)).toBe("Full Moon");
  });

  it("returns Waning Gibbous for angle 225", () => {
    expect(moonPhaseName(225)).toBe("Waning Gibbous");
  });

  it("returns Last Quarter for angle 270", () => {
    expect(moonPhaseName(270)).toBe("Last Quarter");
  });

  it("returns Waning Crescent for angle 315", () => {
    expect(moonPhaseName(315)).toBe("Waning Crescent");
  });

  it("returns Full Moon for angle 200", () => {
    expect(moonPhaseName(200)).toBe("Full Moon");
  });

  it("handles negative angles", () => {
    expect(moonPhaseName(-90)).toBe("Last Quarter");
  });

  it("handles angles > 360", () => {
    expect(moonPhaseName(450)).toBe("First Quarter");
  });

  it("handles boundary at 22.5 — Waxing Crescent", () => {
    expect(moonPhaseName(22.5)).toBe("Waxing Crescent");
  });

  it("handles boundary at 337.5 — New Moon (wraps around)", () => {
    expect(moonPhaseName(337.5)).toBe("New Moon");
  });

  it("handles boundary at 337.499 — Waning Crescent", () => {
    expect(moonPhaseName(337.499)).toBe("Waning Crescent");
  });

  it("handles every named phase at its midpoint", () => {
    expect(moonPhaseName(0)).toBe("New Moon");
    expect(moonPhaseName(45)).toBe("Waxing Crescent");
    expect(moonPhaseName(90)).toBe("First Quarter");
    expect(moonPhaseName(135)).toBe("Waxing Gibbous");
    expect(moonPhaseName(180)).toBe("Full Moon");
    expect(moonPhaseName(225)).toBe("Waning Gibbous");
    expect(moonPhaseName(270)).toBe("Last Quarter");
    expect(moonPhaseName(315)).toBe("Waning Crescent");
  });
});

describe("astronomy-engine moon phase for known dates", () => {
  it("computes near-zero illumination near Jan 6, 2000 new moon", () => {
    const time = MakeTime(new Date("2000-01-06T18:14:00Z"));
    const angle = MoonPhase(time);
    const illum = Illumination(Body.Moon, time);
    const normalized = ((angle % 360) + 360) % 360;
    // New moon: angle should be near 0 or near 360
    const nearZero = normalized < 5 || normalized > 355;
    expect(nearZero).toBe(true);
    expect(moonPhaseName(angle)).toBe("New Moon");
    // Illumination near zero
    expect(illum.phase_fraction).toBeLessThan(0.02);
  });

  it("computes correct near-full moon for a known date", () => {
    const time = MakeTime(new Date("2026-07-27T12:00:00Z"));
    const angle = MoonPhase(time);
    const illum = Illumination(Body.Moon, time);
    const normalized = ((angle % 360) + 360) % 360;
    expect(normalized).toBeGreaterThan(110);
    expect(normalized).toBeLessThan(220);
    expect(illum.phase_fraction).toBeGreaterThan(0.5);
    expect(illum.phase_fraction).toBeLessThan(1.01);
    const name = moonPhaseName(angle);
    expect(["Waxing Gibbous", "Full Moon"].includes(name)).toBe(true);
  });

  it("MoonPhase returns 0-360 range", () => {
    const time = MakeTime(new Date("2026-07-27T12:00:00Z"));
    const angle = MoonPhase(time);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(360);
  });

  it("Illumination returns phase_fraction in 0-1 range", () => {
    const time = MakeTime(new Date("2026-07-27T12:00:00Z"));
    const illum = Illumination(Body.Moon, time);
    expect(illum.phase_fraction).toBeGreaterThanOrEqual(0);
    expect(illum.phase_fraction).toBeLessThanOrEqual(1);
  });
});

describe("astronomy-engine sunrise/sunset", () => {
  it("finds sunrise for Mebane, NC on Jul 27, 2026", () => {
    const observer = new Observer(36.01, -79.227, 0);
    const start = MakeTime(new Date("2026-07-27T04:00:00Z"));
    const rise = SearchRiseSet(Body.Sun, observer, +1, start, 1);
    expect(rise).not.toBeNull();
    const h = rise.date.getUTCHours();
    expect(h).toBeGreaterThanOrEqual(9);
    expect(h).toBeLessThanOrEqual(12);
  });

  it("finds sunset for Mebane, NC on Jul 27, 2026", () => {
    const observer = new Observer(36.01, -79.227, 0);
    const start = MakeTime(new Date("2026-07-27T04:00:00Z"));
    const set = SearchRiseSet(Body.Sun, observer, -1, start, 1);
    expect(set).not.toBeNull();
    const h = set.date.getUTCHours();
    expect(h >= 23 || h <= 1).toBe(true);
  });

  it("sunrise and sunset work for a polar-adjacent latitude (Anchorage)", () => {
    const observer = new Observer(61.22, -149.90, 0);
    const start = MakeTime(new Date("2026-07-27T12:00:00Z"));
    const rise = SearchRiseSet(Body.Sun, observer, +1, start, 2);
    const set = SearchRiseSet(Body.Sun, observer, -1, start, 2);
    expect(rise).not.toBeNull();
    expect(set).not.toBeNull();
    // Both events exist — in July at 61°N the sun does rise and set
  });

  it("handles southern hemisphere correctly", () => {
    const observer = new Observer(-34.60, -58.38, 0);
    const start = MakeTime(new Date("2026-07-27T04:00:00Z"));
    const rise = SearchRiseSet(Body.Sun, observer, +1, start, 2);
    const set = SearchRiseSet(Body.Sun, observer, -1, start, 2);
    expect(rise).not.toBeNull();
    expect(set).not.toBeNull();
  });
});

describe("band calculation logic", () => {
  it("classifies day/night hours with actual sun data", () => {
    const sunLookup = new Map();
    sunLookup.set("2026-07-27", {
      sunrise: new Date("2026-07-27T10:20:00Z"),
      sunset: new Date("2026-07-28T00:25:00Z"),
    });
    sunLookup.set("2026-07-28", {
      sunrise: new Date("2026-07-28T10:21:00Z"),
      sunset: new Date("2026-07-29T00:24:00Z"),
    });

    const rows = [
      {t: new Date("2026-07-27T08:00:00")},
      {t: new Date("2026-07-27T12:00:00")},
      {t: new Date("2026-07-27T16:00:00")},
      {t: new Date("2026-07-28T00:00:00")},
      {t: new Date("2026-07-28T04:00:00")},
      {t: new Date("2026-07-28T08:00:00")},
    ];

    const isNight = rows.map(r => {
      const dateStr = r.t.toISOString().slice(0, 10);
      const s = sunLookup.get(dateStr);
      if (!s || !s.sunrise || !s.sunset) return null;
      return r.t < s.sunrise || r.t >= s.sunset;
    });

    expect(isNight[0]).toBe(false); // 8 AM: day
    expect(isNight[1]).toBe(false); // noon: day
    expect(isNight[2]).toBe(false); // 4 PM: day
    expect(isNight[3]).toBe(true);  // midnight: night
    expect(isNight[4]).toBe(true);  // 4 AM: night
    expect(isNight[5]).toBe(false); // 8 AM next day: day
  });

  it("falls back to heuristic when sun data is missing", () => {
    const sunLookup = new Map();
    const rows = [
      {t: new Date("2026-07-27T02:00:00")},
      {t: new Date("2026-07-27T10:00:00")},
      {t: new Date("2026-07-27T22:00:00")},
    ];

    const isNight = rows.map(r => {
      const dateStr = r.t.toISOString().slice(0, 10);
      const s = sunLookup.get(dateStr);
      if (!s || !s.sunrise || !s.sunset) {
        const h = r.t.getHours();
        return h < 6 || h >= 20;
      }
      return r.t < s.sunrise || r.t >= s.sunset;
    });

    expect(isNight[0]).toBe(true);  // 2 AM: night
    expect(isNight[1]).toBe(false); // 10 AM: day
    expect(isNight[2]).toBe(true);  // 10 PM: night
  });
});
