import { describe, it, expect, vi } from "vitest";
import {
  parseLatLon,
  describeGeolocationError,
  geolocationPermissionState,
  requestPosition,
  geocode,
} from "../src/locate.js";

describe("parseLatLon", () => {
  it("parses a lat,lon pair with surrounding whitespace", () => {
    expect(parseLatLon(" 36.01 , -79.227 ")).toEqual({ lat: 36.01, lon: -79.227 });
  });

  it("rejects place names and malformed input", () => {
    expect(parseLatLon("Greensboro, NC")).toBeNull();
    expect(parseLatLon("36.01")).toBeNull();
    expect(parseLatLon("1,2,3")).toBeNull();
    expect(parseLatLon("")).toBeNull();
    expect(parseLatLon(null)).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    expect(parseLatLon("95,0")).toBeNull();
    expect(parseLatLon("0,200")).toBeNull();
  });
});

describe("describeGeolocationError", () => {
  it("maps PositionError codes to actionable text", () => {
    expect(describeGeolocationError({ code: 1 })).toMatch(/permission was denied/i);
    expect(describeGeolocationError({ code: 2 })).toMatch(/could not determine/i);
    expect(describeGeolocationError({ code: 3 })).toMatch(/timed out/i);
  });

  it("falls back to the error message, then a generic string", () => {
    expect(describeGeolocationError({ message: "boom" })).toBe("boom");
    expect(describeGeolocationError(null)).toBe("Location lookup failed.");
  });
});

describe("geolocationPermissionState", () => {
  it("reports the browser permission state", async () => {
    const nav = { permissions: { query: async () => ({ state: "denied" }) } };
    expect(await geolocationPermissionState(nav)).toBe("denied");
  });

  it("reports unsupported when the Permissions API is missing", async () => {
    expect(await geolocationPermissionState({})).toBe("unsupported");
  });

  it("reports unknown when the query throws", async () => {
    const nav = { permissions: { query: () => { throw new Error("nope"); } } };
    expect(await geolocationPermissionState(nav)).toBe("unknown");
  });
});

describe("requestPosition", () => {
  it("resolves with the position", async () => {
    const pos = { coords: { latitude: 1, longitude: 2, accuracy: 10 } };
    const nav = { geolocation: { getCurrentPosition: (ok) => ok(pos) } };
    await expect(requestPosition({ nav })).resolves.toBe(pos);
  });

  it("rejects with mapped text when the browser reports an error", async () => {
    const nav = { geolocation: { getCurrentPosition: (_ok, fail) => fail({ code: 1 }) } };
    await expect(requestPosition({ nav })).rejects.toThrow(/permission was denied/i);
  });

  it("rejects when the browser never calls back at all", async () => {
    vi.useFakeTimers();
    try {
      const nav = { geolocation: { getCurrentPosition: () => {} } };
      const p = requestPosition({ nav, watchdogMs: 1000 });
      const assertion = expect(p).rejects.toThrow(/never answered/i);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fire the watchdog after a successful callback", async () => {
    vi.useFakeTimers();
    try {
      const pos = { coords: { latitude: 1, longitude: 2 } };
      const nav = { geolocation: { getCurrentPosition: (ok) => ok(pos) } };
      await expect(requestPosition({ nav, watchdogMs: 1000 })).resolves.toBe(pos);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when geolocation is unavailable", async () => {
    await expect(requestPosition({ nav: {} })).rejects.toThrow(/not supported/i);
  });

  it("retries with high accuracy and no cache when the position is unavailable", async () => {
    const pos = { coords: { latitude: 1, longitude: 2 } };
    const calls = [];
    const nav = {
      geolocation: {
        getCurrentPosition: (ok, fail, options) => {
          calls.push(options);
          if (calls.length === 1) fail({ code: 2 });
          else ok(pos);
        },
      },
    };
    await expect(requestPosition({ nav })).resolves.toBe(pos);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ enableHighAccuracy: false });
    expect(calls[1]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
  });

  it("reports the second failure when the retry also fails", async () => {
    let calls = 0;
    const nav = {
      geolocation: {
        getCurrentPosition: (_ok, fail) => {
          calls += 1;
          fail({ code: 2 });
        },
      },
    };
    await expect(requestPosition({ nav })).rejects.toThrow(/could not determine/i);
    expect(calls).toBe(2);
  });

  it("does not retry a permission denial", async () => {
    let calls = 0;
    const nav = {
      geolocation: {
        getCurrentPosition: (_ok, fail) => {
          calls += 1;
          fail({ code: 1 });
        },
      },
    };
    await expect(requestPosition({ nav })).rejects.toThrow(/permission was denied/i);
    expect(calls).toBe(1);
  });

  it("does not retry when the browser never calls back", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const nav = { geolocation: { getCurrentPosition: () => { calls += 1; } } };
      const p = requestPosition({ nav, watchdogMs: 1000 });
      const assertion = expect(p).rejects.toThrow(/never answered/i);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("geocode", () => {
  it("returns the first match", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => [{ lat: "36.07", lon: "-79.79", display_name: "Greensboro, NC" }],
    });
    await expect(geocode("Greensboro", { fetchImpl })).resolves.toEqual({
      lat: 36.07,
      lon: -79.79,
      label: "Greensboro, NC",
    });
  });

  it("returns null when there are no matches", async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => [] });
    await expect(geocode("zzzz", { fetchImpl })).resolves.toBeNull();
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = async () => ({ ok: false, status: 503 });
    await expect(geocode("Greensboro", { fetchImpl })).rejects.toThrow(/503/);
  });
});
