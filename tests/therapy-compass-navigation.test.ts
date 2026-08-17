import { describe, expect, it } from "vitest";

import {
  DEFAULT_THERAPY_WORKSPACE_STATE,
  readTherapyWorkspaceState,
  resolveTherapyRoute,
  therapyRecordHref,
  therapyScreenHref,
  therapyWorkspaceNavigationEntries,
  therapyWorkspaceSearchParams,
} from "@/lib/therapy-compass-navigation";

describe("Therapy Compass canonical navigation", () => {
  it("resolves homes, workflows, records and record-owned outputs", () => {
    expect(resolveTherapyRoute("/therapy-compass")).toEqual({ screen: "home", slug: null });
    expect(resolveTherapyRoute("/therapy-compass/compare")).toEqual({ screen: "compare", slug: null });
    expect(resolveTherapyRoute("/therapy-compass/cbt")).toEqual({ screen: "detail", slug: "cbt" });
    expect(resolveTherapyRoute("/therapy-compass/cbt/brief")).toEqual({ screen: "brief", slug: "cbt" });
    expect(resolveTherapyRoute("/therapy-compass/cbt/sheet")).toEqual({ screen: "sheets", slug: "cbt" });
    expect(therapyScreenHref("search")).toBe("/therapy-compass/search");
    expect(therapyRecordHref("cbt", "sheet")).toBe("/therapy-compass/cbt/sheet");
  });

  it("round-trips encoded record slugs and tolerates malformed path encoding", () => {
    const slug = "acceptance/commitment therapy";
    expect(resolveTherapyRoute(therapyRecordHref(slug))).toEqual({ screen: "detail", slug });
    expect(resolveTherapyRoute("/therapy-compass/%E0%A4%A")).toEqual({
      screen: "detail",
      slug: "%E0%A4%A",
    });
  });

  it("round-trips every approved shareable workspace choice", () => {
    const state = {
      ...DEFAULT_THERAPY_WORKSPACE_STATE,
      compareSlugs: ["cbt", "dbt"],
      topics: ["Mood", "Trauma"],
      briefOnly: true,
      sheetOnly: true,
      reviewedOnly: true,
      constraints: [],
      pathwaySlug: "acute-anxiety",
      comparison: "all" as const,
      density: "dense" as const,
      duration: "15min" as const,
      tone: "warm" as const,
      sections: [],
      clinician: false,
    };
    const params = therapyWorkspaceSearchParams(new URLSearchParams("q=anxiety&run=1"), state);

    expect(readTherapyWorkspaceState(params)).toEqual(state);
    expect(params.get("q")).toBe("anxiety");
    expect(params.get("run")).toBe("1");
  });

  it("never serializes or carries recommendation and patient free text", () => {
    const current = new URLSearchParams(
      "q=anxiety&run=1&recQuery=patient+name&prompt=private&patient=private&notes=private&ids=cbt,dbt",
    );
    const canonical = therapyWorkspaceSearchParams(current, {
      ...DEFAULT_THERAPY_WORKSPACE_STATE,
      compareSlugs: ["cbt", "dbt"],
    });

    expect(canonical.has("recQuery")).toBe(false);
    expect(canonical.has("prompt")).toBe(false);
    expect(canonical.has("patient")).toBe(false);
    expect(canonical.has("notes")).toBe(false);
    expect(therapyWorkspaceNavigationEntries(current)).toEqual([
      ["q", "anxiety"],
      ["run", "1"],
      ["ids", "cbt,dbt"],
    ]);
  });

  it("caps and de-duplicates comparison IDs from untrusted URLs", () => {
    const state = readTherapyWorkspaceState(new URLSearchParams("ids=a,a,b,c,d,e,,"));
    expect(state.compareSlugs).toEqual(["a", "b", "c", "d"]);
  });

  it("serializes patient-sheet sections in canonical order", () => {
    const params = therapyWorkspaceSearchParams(new URLSearchParams(), {
      ...DEFAULT_THERAPY_WORKSPACE_STATE,
      sections: ["contacts", "about", "practice"],
    });

    expect(params.getAll("section")).toEqual(["about", "practice", "contacts"]);
    expect(readTherapyWorkspaceState(params).sections).toEqual(["about", "practice", "contacts"]);
  });
});
