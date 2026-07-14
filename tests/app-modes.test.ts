import { describe, expect, it } from "vitest";

import {
  appModeDefinitions,
  appModeCanUseSourceLibraryShortcut,
  appModeHomeHref,
  appModeQueryMode,
  appModeSearchConfig,
  appModeSourceLibrarySearchMode,
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

  it("keeps tools searchable inside the dashboard composer", () => {
    const config = appModeSearchConfig("tools");

    expect(isSearchableAppMode("tools")).toBe(true);
    expect(config.kind).toBe("tools");
    expect(config.resultKind).toBe("tools");
    expect(config.placeholder.toLowerCase()).toContain("tools");
  });

  it("keeps services searchable through the shared dashboard composer", () => {
    const config = appModeSearchConfig("services");
    const mode = appModeDefinitions.find((definition) => definition.id === "services");

    expect(isSearchableAppMode("services")).toBe(true);
    expect(mode?.label).toBe("Services");
    expect(config.kind).toBe("services");
    expect(config.resultKind).toBe("services");
    expect(config.placeholder.toLowerCase()).toContain("services");
  });

  it("keeps forms searchable as a first-class mode", () => {
    const config = appModeSearchConfig("forms");
    const mode = appModeDefinitions.find((definition) => definition.id === "forms");

    expect(isSearchableAppMode("forms")).toBe(true);
    expect(mode?.label).toBe("Forms");
    expect(mode?.href).toBe("/forms");
    // Forms are a registry catalogue with their own honest kind — no longer masquerading
    // as corpus documents (which forced downstream special-casing).
    expect(config.kind).toBe("forms");
    expect(config.resultKind).toBe("forms");
    expect(config.placeholder.toLowerCase()).toContain("forms");
  });

  it("keeps favourites searchable as a standalone saved-items mode", () => {
    const config = appModeSearchConfig("favourites");
    const mode = appModeDefinitions.find((definition) => definition.id === "favourites");

    expect(isSearchableAppMode("favourites")).toBe(true);
    expect(mode?.label).toBe("Favourites");
    expect(mode?.href).toBe("/favourites");
    expect(config.kind).toBe("favourites");
    expect(config.resultKind).toBe("favourites");
    expect(config.placeholder.toLowerCase()).toContain("favourites");
  });

  it("keeps differentials searchable as a standalone source-library mode", () => {
    const config = appModeSearchConfig("differentials");

    expect(isSearchableAppMode("differentials")).toBe(true);
    expect(config.kind).toBe("differentials");
    expect(config.resultKind).toBe("differentials");
    expect(config.placeholder.toLowerCase()).toContain("presentation");
    expect(appModeQueryMode("differentials", "auto")).toBe("compare_guidance");
  });

  it("keeps formulation searchable as a standalone local decision-support mode", () => {
    const config = appModeSearchConfig("formulation");
    const mode = appModeDefinitions.find((definition) => definition.id === "formulation");

    expect(isSearchableAppMode("formulation")).toBe(true);
    expect(mode?.href).toBe("/formulation");
    expect(config.kind).toBe("formulation");
    expect(config.resultKind).toBe("formulation");
    expect(config.placeholder.toLowerCase()).toContain("pattern");
  });

  it("keeps source-library shortcut searches in their active mode family", () => {
    expect(appModeCanUseSourceLibraryShortcut("answer")).toBe(false);
    expect(appModeCanUseSourceLibraryShortcut("tools")).toBe(false);
    expect(appModeCanUseSourceLibraryShortcut("documents")).toBe(true);
    expect(appModeCanUseSourceLibraryShortcut("services")).toBe(false);
    // Forms is a registry catalogue: a scope-tag shortcut falls back to documents mode
    // instead of dead-ending in the forms registry branch.
    expect(appModeCanUseSourceLibraryShortcut("forms")).toBe(false);
    expect(appModeCanUseSourceLibraryShortcut("favourites")).toBe(false);
    expect(appModeCanUseSourceLibraryShortcut("prescribing")).toBe(true);
    expect(appModeCanUseSourceLibraryShortcut("differentials")).toBe(true);
    expect(appModeCanUseSourceLibraryShortcut("formulation")).toBe(false);

    expect(appModeSourceLibrarySearchMode("documents")).toBe("documents");
    expect(appModeSourceLibrarySearchMode("services")).toBe("documents");
    expect(appModeSourceLibrarySearchMode("forms")).toBe("documents");
    expect(appModeSourceLibrarySearchMode("prescribing")).toBe("documents");
    expect(appModeSourceLibrarySearchMode("differentials")).toBe("differentials");
  });

  it("builds stable dashboard home URLs for shared global search chrome", () => {
    expect(appModeHomeHref("answer")).toBe("/?mode=answer");
    expect(appModeHomeHref("documents", { query: "lithium monitoring", run: true, focus: true })).toBe(
      "/documents/search?mode=documents&q=lithium+monitoring&focus=1&run=1",
    );
    expect(appModeHomeHref("services")).toBe("/services");
    expect(appModeHomeHref("services", { focus: true })).toBe("/services?focus=1");
    expect(appModeHomeHref("services", { query: "  13YARN  ", run: true, focus: true })).toBe(
      "/services?q=13YARN&focus=1&run=1",
    );
    expect(appModeHomeHref("forms")).toBe("/forms");
    expect(appModeHomeHref("forms", { focus: true })).toBe("/forms?focus=1");
    expect(appModeHomeHref("forms", { query: "  transport forms  ", run: true, focus: true })).toBe(
      "/forms?q=transport+forms&focus=1&run=1",
    );
    expect(appModeHomeHref("favourites")).toBe("/favourites");
    expect(appModeHomeHref("favourites", { query: "  clozapine set  ", run: true, focus: true })).toBe(
      "/favourites?q=clozapine+set&focus=1&run=1",
    );
    expect(appModeHomeHref("differentials", { query: "  acute confusion  ", focus: true })).toBe(
      "/differentials?q=acute+confusion&focus=1",
    );
    expect(appModeHomeHref("formulation", { query: "  I keep going over it  ", run: true, focus: true })).toBe(
      "/formulation?q=I+keep+going+over+it&focus=1&run=1",
    );
    expect(appModeHomeHref("prescribing", { query: "  acamprosate renal dose  " })).toBe(
      "/?mode=prescribing&q=acamprosate+renal+dose",
    );
    expect(appModeHomeHref("tools", { query: "  medications  ", run: true, focus: true })).toBe(
      "/?mode=tools&q=medications&focus=1&run=1",
    );
  });

  it("keeps active search context while routing from the shared composer", () => {
    const href = new URL(
      appModeHomeHref("answer", {
        query: "clozapine monitoring",
        run: true,
        queryMode: "monitoring_schedule",
        scopeFilters: { medications: ["clozapine"], sourceStatuses: ["current"] },
      }),
      "https://clinical.test",
    );

    expect(href.searchParams.get("queryMode")).toBe("monitoring_schedule");
    expect(href.searchParams.getAll("scope.medications")).toEqual(["clozapine"]);
    expect(href.searchParams.getAll("scope.sourceStatuses")).toEqual(["current"]);
  });

  it("keeps active production modes and excludes removed prototype modes from app routing", () => {
    expect(isAppModeId("profile")).toBe(false);
    expect(appModeDefinitions.map((mode) => mode.id)).not.toContain("profile");
    expect(appModeDefinitions.map((mode) => mode.id)).toEqual(
      expect.arrayContaining([
        "answer",
        "documents",
        "services",
        "forms",
        "favourites",
        "differentials",
        "formulation",
        "prescribing",
        "tools",
      ]),
    );
    expect(visibleAppModeDefinitions("development").map((mode) => mode.id)).not.toContain("profile");
  });

  it("keeps production navigation modes visible while removed prototypes stay hidden", () => {
    const developmentModes = visibleAppModeDefinitions("development").map((mode) => mode.id);
    const productionModes = visibleAppModeDefinitions("production").map((mode) => mode.id);

    expect(isAppModeVisible("evidence", "production")).toBe(false);
    expect(isAppModeVisible("services", "production")).toBe(true);
    expect(isAppModeVisible("forms", "production")).toBe(true);
    expect(isAppModeVisible("favourites", "production")).toBe(true);
    expect(isAppModeVisible("differentials", "production")).toBe(true);
    expect(isAppModeVisible("formulation", "production")).toBe(true);
    expect(isAppModeVisible("prescribing", "production")).toBe(true);
    expect(isAppModeVisible("tools", "production")).toBe(true);
    expect(productionModes).not.toContain("evidence");
    expect(productionModes).toContain("services");
    expect(productionModes).toContain("forms");
    expect(productionModes).toContain("favourites");
    expect(productionModes).toContain("differentials");
    expect(productionModes).toContain("formulation");
    expect(productionModes).toContain("prescribing");
    expect(productionModes).toContain("tools");
    expect(developmentModes).toEqual(
      expect.arrayContaining([
        "answer",
        "documents",
        "services",
        "forms",
        "favourites",
        "differentials",
        "formulation",
        "prescribing",
        "tools",
      ]),
    );
    expect(developmentModes).not.toContain("evidence");
  });
});
