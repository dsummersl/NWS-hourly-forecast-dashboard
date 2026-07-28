import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("manifest.json validation", () => {
  it("contains valid PWA shortcuts and widgets definitions", () => {
    const raw = readFileSync(join(__dirname, "..", "src", "manifest.json"), "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.shortcuts).toBeDefined();
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
    expect(manifest.shortcuts[0].url).toContain("./widget");

    expect(manifest.widgets).toBeDefined();
    expect(manifest.widgets.length).toBeGreaterThan(0);
    expect(manifest.widgets[0].src).toContain("./widget");
  });
});
