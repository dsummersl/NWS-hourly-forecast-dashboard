import {describe, it, expect} from "vitest";
import {moonSVGDataURL, moonPhaseName} from "../src/moonsvg.js";

describe("moonPhaseName", () => {
  it("returns New Moon for angle 0", () => expect(moonPhaseName(0)).toBe("New Moon"));
  it("returns Waxing Crescent for 45", () => expect(moonPhaseName(45)).toBe("Waxing Crescent"));
  it("returns First Quarter for 90", () => expect(moonPhaseName(90)).toBe("First Quarter"));
  it("returns Waxing Gibbous for 135", () => expect(moonPhaseName(135)).toBe("Waxing Gibbous"));
  it("returns Full Moon for 180", () => expect(moonPhaseName(180)).toBe("Full Moon"));
  it("returns Waning Gibbous for 225", () => expect(moonPhaseName(225)).toBe("Waning Gibbous"));
  it("returns Last Quarter for 270", () => expect(moonPhaseName(270)).toBe("Last Quarter"));
  it("returns Waning Crescent for 315", () => expect(moonPhaseName(315)).toBe("Waning Crescent"));
});

describe("moonSVGDataURL", () => {
  it("returns null for null phase", () => {
    expect(moonSVGDataURL(null)).toBeNull();
  });

  it("returns a data URL string for valid phase", () => {
    const url = moonSVGDataURL(0.5, 20);
    expect(url).toMatch(/^data:image\/svg\+xml,/);
    expect(url.length).toBeGreaterThan(50);
  });

  it("new moon (phase 0) renders a faint circle outline", () => {
    const url = moonSVGDataURL(0, 20);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain("circle");
    expect(decoded).toContain('stroke="#ffffff"');
  });

  it("full moon (phase 0.5) renders a solid circle", () => {
    const url = moonSVGDataURL(0.5, 20);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain("circle");
    expect(decoded).toContain('fill="#ffffff"');
    expect(decoded).not.toContain("stroke");
  });

  it("waxing crescent (phase 0.125) renders a path with right semicircle", () => {
    const url = moonSVGDataURL(0.125, 20);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain("<path ");
    // Right semicircle uses sweep-flag 1: the second "1" in "0 0,1"
    expect(decoded).toMatch(/0 0,1/);
  });

  it("waning crescent (phase 0.875) renders a path with left semicircle", () => {
    const url = moonSVGDataURL(0.875, 20);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain("<path ");
    // Left semicircle uses sweep-flag 0: "0 0,0"
    expect(decoded).toMatch(/0 0,0/);
  });

  it("first quarter (phase 0.25) renders a path", () => {
    const url = moonSVGDataURL(0.25, 20);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain("<path ");
    // cos(π/2)=0, so rx=0.5 (minimum)
    expect(decoded).toContain("0.5,");
  });

  it("last quarter (phase 0.75) renders a path", () => {
    const url = moonSVGDataURL(0.75, 20);
    const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain("<path ");
  });

  it("all phases produce valid SVG", () => {
    for (let i = 0; i <= 100; i++) {
      const phase = i / 100;
      const url = moonSVGDataURL(phase, 20);
      expect(url).toMatch(/^data:image\/svg\+xml,/);
      const decoded = decodeURIComponent(url.replace("data:image/svg+xml,", ""));
      expect(decoded).toContain("<svg");
      expect(decoded).toContain("</svg>");
    }
  });

  it("opacity parameter affects the SVG", () => {
    const dim = moonSVGDataURL(0.5, 20, 0.3);
    const decoded = decodeURIComponent(dim.replace("data:image/svg+xml,", ""));
    expect(decoded).toContain('fill-opacity="0.3"');

    const bright = moonSVGDataURL(0.5, 20, 0.9);
    const decoded2 = decodeURIComponent(bright.replace("data:image/svg+xml,", ""));
    expect(decoded2).toContain('fill-opacity="0.9"');
  });
});
