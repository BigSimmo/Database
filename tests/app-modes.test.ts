import { describe, expect, it } from "vitest";

import {
  appModeDefinitions,
  appModeHomeHref,
  appModeQueryMode,
  appModeSearchConfig,
  isAppModeId,
  isAppModeVisible,
  isSearchableAppMode,
  visibleAppModeDefinitions,
} from "@/lib/app-modes";

describe("app mode search contract", () => {
  it("requires every mode to declare its search behavior and copy", () => {
    const ids = new Set<string>();

    for (const mode of appModeDefinitions) {
      expect(ids.has(mode.id)).toBe(false);
      ids.add(mode.id);

      expect(mode.label).toBeTruthy();
      expect(mode.description).toBeTruthy();
      expect(mode.search.placeholder).toBeTruthy();
      expect(mode.search.inputAriaLabel).toBeTruthy();
      expect(mode.search.submitIdleLabel).toBeTruthy();
      expect(mode.search.submitBusyLabel).toBeTruthy();
      expect(mode.search.submitAriaLabel).toBeTruthy();
      expect(mode.search.emptyTitle).toBeTruthy();
      expect(mode.search.readyTitle).toBeTruthy();
      expect(mode.search.progressLabel).toBeTruthy();
      expect(mode.search.resultHeading).toBeTruthy();
    }
  });

  it("keeps every declared mode searchable through the dashboard composer", () => {
    for (const mode of appModeDefinitions) {
      expect(isSearchableAppMode(mode.id)).toBe(true);
    }
  });

  it("routes medication mode through document search with a medication-oriented query mode", () => {
    expect(isSearchableAppMode("prescribing")).toBe(true);
    expect(appModeSearchConfig("prescribing").kind).toBe("documents");
    expect(appModeQueryMode("prescribing", "auto")).toBe("dose_threshold_lookup");
    expect(appModeQueryMode("prescribing", "monitoring_schedule")).toBe("monitoring_schedule");
  });

  it("keeps favourites searchable inside the dashboard composer", () => {
    const config = appModeSearchConfig("favourites");

    expect(isSearchableAppMode("favourites")).toBe(true);
    expect(config.kind).toBe("favourites");
    expect(config.resultKind).toBe("favourites");
    expect(config.placeholder.toLowerCase()).toContain("favourites");
  });

  it("keeps tools searchable inside the dashboard composer", () => {
    const config = appModeSearchConfig("tools");

    expect(isSearchableAppMode("tools")).toBe(true);
    expect(config.kind).toBe("tools");
    expect(config.resultKind).toBe("tools");
    expect(config.placeholder.toLowerCase()).toContain("tools");
  });

  it("builds stable dashboard home URLs for shared global search chrome", () => {
    expect(appModeHomeHref("answer")).toBe("/?mode=answer");
    expect(appModeHomeHref("documents", { query: "lithium monitoring", run: true, focus: true })).toBe(
      "/?mode=documents&q=lithium+monitoring&focus=1&run=1",
    );
    expect(appModeHomeHref("prescribing", { query: "  acamprosate renal dose  " })).toBe(
      "/?mode=prescribing&q=acamprosate+renal+dose",
    );
    expect(appModeHomeHref("favourites")).toBe("/?mode=favourites");
    expect(appModeHomeHref("tools", { query: "  medications  ", run: true, focus: true })).toBe(
      "/?mode=tools&q=medications&focus=1&run=1",
    );
  });

  it("keeps evidence and tools while keeping the removed profile mockup out of app mode routing", () => {
    expect(isAppModeId("profile")).toBe(false);
    expect(appModeDefinitions.map((mode) => mode.id)).not.toContain("profile");
    expect(appModeDefinitions.map((mode) => mode.id)).toEqual(
      expect.arrayContaining(["answer", "documents", "prescribing", "evidence", "favourites", "tools"]),
    );
    expect(visibleAppModeDefinitions("development").map((mode) => mode.id)).not.toContain("profile");
  });

  it("keeps medication visible while mock-backed modes stay out of production navigation", () => {
    const productionModes = visibleAppModeDefinitions("production").map((mode) => mode.id);
    const developmentModes = visibleAppModeDefinitions("development").map((mode) => mode.id);

    expect(isAppModeVisible("favourites", "production")).toBe(false);
    expect(isAppModeVisible("prescribing", "production")).toBe(true);
    expect(isAppModeVisible("tools", "production")).toBe(true);
    expect(productionModes).not.toContain("favourites");
    expect(productionModes).toContain("prescribing");
    expect(productionModes).toContain("tools");
    expect(developmentModes).toEqual(expect.arrayContaining(["evidence", "favourites", "prescribing", "tools"]));
  });
});
