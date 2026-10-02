/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import {
  ADMIN_PIN_LIMIT,
  adminPinsStorageKey,
  clearAdminPins,
  parseAdminPins,
  readAdminPins,
  setAdminPinned,
} from "@/lib/admin/pins";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

afterEach(() => window.localStorage.clear());

describe("Admin pinned numbers (owner decision 2026-10-01: device only, row ids only)", () => {
  it("adds and removes a pin, storing nothing but the row id", () => {
    expect(setAdminPinned(A, true)).toBe(true);
    expect(setAdminPinned(B, true)).toBe(true);
    expect(readAdminPins()).toEqual([A, B]);
    expect(window.localStorage.getItem(adminPinsStorageKey)).toBe(JSON.stringify([A, B]));
    setAdminPinned(A, false);
    expect(readAdminPins()).toEqual([B]);
    setAdminPinned(B, false);
    expect(window.localStorage.getItem(adminPinsStorageKey)).toBeNull();
  });

  it("refuses anything that is not a row id, so no title or number can reach the device", () => {
    expect(setAdminPinned("0412 345 678", true)).toBe(false);
    expect(setAdminPinned("Security escort", true)).toBe(false);
    expect(window.localStorage.getItem(adminPinsStorageKey)).toBeNull();
    expect(parseAdminPins(JSON.stringify(["Security escort", A, A, 7]))).toEqual([A]);
    expect(parseAdminPins("not json")).toEqual([]);
  });

  it("caps the list, dropping the oldest pin", () => {
    const ids = Array.from(
      { length: ADMIN_PIN_LIMIT + 1 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    for (const id of ids) setAdminPinned(id, true);
    expect(readAdminPins()).toEqual(ids.slice(1));
  });

  it("is removed at sign-out and account switch", () => {
    setAdminPinned(A, true);
    clearAdminPins();
    expect(window.localStorage.getItem(adminPinsStorageKey)).toBeNull();
    expect(readFileSync("src/lib/supabase/client.tsx", "utf8")).toContain("clearAdminPins()");
  });
});
