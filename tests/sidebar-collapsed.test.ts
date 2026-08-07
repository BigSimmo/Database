import { describe, expect, it } from "vitest";
import {
  readSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from "../src/components/clinical-dashboard/use-sidebar-collapsed";

describe("readSidebarCollapsedPreference", () => {
  it("defaults to collapsed when the preference key is absent", () => {
    expect(readSidebarCollapsedPreference(null)).toBe(true);
    expect(readSidebarCollapsedPreference(undefined)).toBe(true);
  });

  it("honours an explicit expanded pin", () => {
    expect(readSidebarCollapsedPreference("0")).toBe(false);
  });

  it("honours an explicit collapsed pin", () => {
    expect(readSidebarCollapsedPreference("1")).toBe(true);
  });

  it('only treats an explicit "1" as collapsed when a value is present', () => {
    // Preserves the pre-existing ternary: absent → collapsed; otherwise
    // collapsed iff the stored pin is exactly "1". Stale/garbage pins expand.
    expect(readSidebarCollapsedPreference("")).toBe(false);
    expect(readSidebarCollapsedPreference("true")).toBe(false);
    expect(readSidebarCollapsedPreference("collapsed")).toBe(false);
  });

  it("pins the storage key used by Playwright seeds and the browser store", () => {
    expect(SIDEBAR_COLLAPSED_STORAGE_KEY).toBe("clinical-kb-sidebar-collapsed");
  });
});
