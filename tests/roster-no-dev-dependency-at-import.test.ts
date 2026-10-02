import { describe, expect, it, vi } from "vitest";

/*
 * jsdom is a dev dependency, so it is missing from the production image. On
 * 2026-09-29 every Roster route that imported the calendar-link code failed with
 * "Cannot find module 'jsdom'", because the source-acquisition module it borrows
 * `isGlobalPublicAddress` from required jsdom at import. Loading Roster's server
 * code must never need jsdom.
 */

vi.mock("server-only", () => ({}));
vi.mock("node:module", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:module")>();
  const createRequire = (url: string | URL) => {
    const real = actual.createRequire(url);
    return Object.assign((id: string) => {
      if (id === "jsdom") throw new Error("Cannot find module 'jsdom'");
      return real(id);
    }, real);
  };
  return { ...actual, createRequire, default: { ...actual, createRequire } };
});

describe("Roster server code without dev dependencies", () => {
  it("loads the calendar-link modules when jsdom is not installed", async () => {
    await expect(import("@/lib/roster/calendar-links")).resolves.toBeTruthy();
    await expect(import("@/lib/roster/calendar-link-fetch")).resolves.toBeTruthy();
    const { isGlobalPublicAddress } = await import("@/lib/public-source-acquisition");
    expect(isGlobalPublicAddress("8.8.8.8")).toBe(true);
    expect(isGlobalPublicAddress("10.0.0.1")).toBe(false);
  });
});
