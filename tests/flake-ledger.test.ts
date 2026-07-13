import { describe, expect, it } from "vitest";
import { isKnownFlake, loadFlakeLedger, matchFlake } from "../scripts/flake-ledger.mjs";

describe("flake ledger", () => {
  it("loads and validates the committed ledger", () => {
    const flakes = loadFlakeLedger();
    expect(flakes.length).toBeGreaterThan(0);
    for (const flake of flakes) {
      expect(flake.id).toBeTruthy();
      expect(flake.match).toBeTruthy();
      expect(flake.spec).toMatch(/^tests\//);
      expect(flake.reason).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = loadFlakeLedger().map((f: { id: string }) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches a known flake by case-insensitive title substring", () => {
    expect(isKnownFlake("Composer Hero mounts after hydration")).toBe(true);
    const hit = matchFlake("the tap target is at least 44px");
    expect(hit?.id).toBe("tap-target-subpixel");
  });

  it("does not match an unrelated title or an empty string", () => {
    expect(isKnownFlake("renders the medication results grid")).toBe(false);
    expect(matchFlake("")).toBeNull();
  });
});
