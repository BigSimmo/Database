import { describe, expect, it } from "vitest";

import {
  defaultSidebarPinnedModeIds,
  pinnableSidebarModeIds,
  readSidebarPinnedModes,
} from "@/components/clinical-dashboard/use-sidebar-pins";

describe("sidebar pin persistence", () => {
  it("uses the six product defaults for missing or malformed preferences", () => {
    expect(defaultSidebarPinnedModeIds).toHaveLength(6);
    expect(defaultSidebarPinnedModeIds).not.toContain("sources");
    expect(pinnableSidebarModeIds).toContain("sources");
    expect(readSidebarPinnedModes(null)).toEqual(defaultSidebarPinnedModeIds);
    expect(readSidebarPinnedModes("not-json")).toEqual(defaultSidebarPinnedModeIds);
    expect(readSidebarPinnedModes(JSON.stringify({ answer: true }))).toEqual(defaultSidebarPinnedModeIds);
  });

  it("accepts Sources as a user pin", () => {
    expect(readSidebarPinnedModes(JSON.stringify(["sources", "answer"]))).toEqual(["sources", "answer"]);
  });

  it("keeps an intentional empty list and removes unknown or duplicate mode ids", () => {
    expect(readSidebarPinnedModes("[]")).toEqual([]);
    expect(readSidebarPinnedModes(JSON.stringify(["forms", "unknown", "forms", "answer"]))).toEqual([
      "forms",
      "answer",
    ]);
  });
});
