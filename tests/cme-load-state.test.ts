import { afterEach, describe, expect, it, vi } from "vitest";

import { cmeSaveErrorText, cmeStateFromError } from "@/lib/cme/load-state";

afterEach(() => vi.unstubAllGlobals());

describe("cmeStateFromError — one rule for every CPD page", () => {
  it.each([
    ["Chrome", "Failed to fetch"],
    ["Firefox", "NetworkError when attempting to fetch resource."],
    ["Safari", "Load failed"],
  ])("reads %s's network TypeError as offline", (_browser, message) => {
    expect(cmeStateFromError(new TypeError(message))).toBe("offline");
  });

  it("reads the phone saying it has no connection as offline, whatever the error", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(cmeStateFromError(new Error("Could not save this entry (503)."))).toBe("offline");
  });

  it.each([
    ["a non-OK response turned into an Error", new Error("Could not save this entry (503).")],
    ["a programming TypeError", new TypeError("Cannot read properties of undefined (reading 'id')")],
    ["a thrown string", "boom"],
    ["nothing at all", undefined],
  ])("reads %s as error", (_label, error) => {
    expect(cmeStateFromError(error)).toBe("error");
  });
});

describe("cmeSaveErrorText", () => {
  it("names being offline instead of the browser's fetch error", () => {
    expect(cmeSaveErrorText(new TypeError("Failed to fetch"), "Could not save this entry.")).toMatch(
      /offline, so nothing was saved/,
    );
  });
  it("keeps the server's own message, and falls back when there is none", () => {
    expect(cmeSaveErrorText(new Error("Hours must be above zero."), "x")).toBe("Hours must be above zero.");
    expect(cmeSaveErrorText("boom", "Could not save this entry.")).toBe("Could not save this entry.");
  });
});
