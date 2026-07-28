import { describe, it, expect } from "vitest";
import { computeWidgetWindow, filterWidgetData, getCurrentTempSummary } from "../src/widget-temp.js";

describe("computeWidgetWindow", () => {
  it("calculates xStart and xEnd correctly with current time offset to the left", () => {
    const now = new Date("2026-07-28T14:30:00Z");
    const pastHours = 2;
    const totalHours = 24;

    const { xStart, xEnd, xDomain, now: returnedNow } = computeWidgetWindow(now, pastHours, totalHours);

    expect(returnedNow).toEqual(now);
    expect(xStart.toISOString()).toBe("2026-07-28T12:30:00.000Z");
    expect(xEnd.toISOString()).toBe("2026-07-29T12:30:00.000Z");
    expect(xDomain[0]).toEqual(xStart);
    expect(xDomain[1]).toEqual(xEnd);

    // Verify 'now' is offset to the left (2/24 = 8.33% of the total duration)
    const totalMs = xEnd.getTime() - xStart.getTime();
    const nowOffsetMs = now.getTime() - xStart.getTime();
    const ratio = nowOffsetMs / totalMs;
    expect(ratio).toBeCloseTo(2 / 24, 2);
  });
});

describe("filterWidgetData", () => {
  it("filters rows within window with padding", () => {
    const hours = Array.from({ length: 48 }, (_, i) => {
      const t = new Date(Date.UTC(2026, 6, 28, i));
      return { t, temperature: 70 + i };
    });

    const xStart = new Date("2026-07-28T05:00:00Z");
    const xEnd = new Date("2026-07-28T10:00:00Z");

    const filtered = filterWidgetData(hours, xStart, xEnd);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].t.getTime()).toBeLessThanOrEqual(xStart.getTime());
    expect(filtered[filtered.length - 1].t.getTime()).toBeGreaterThanOrEqual(xEnd.getTime());
  });
});

describe("getCurrentTempSummary", () => {
  it("finds closest row to current time", () => {
    const rows = [
      { t: new Date("2026-07-28T12:00:00Z"), temperature: 72, apparent: 74, dewpoint: 55 },
      { t: new Date("2026-07-28T13:00:00Z"), temperature: 75, apparent: 77, dewpoint: 56 },
      { t: new Date("2026-07-28T14:00:00Z"), temperature: 78, apparent: 80, dewpoint: 58 },
    ];
    const now = new Date("2026-07-28T12:45:00Z");
    const current = getCurrentTempSummary(rows, now);
    expect(current.temperature).toBe(75);
    expect(current.apparent).toBe(77);
  });
});
