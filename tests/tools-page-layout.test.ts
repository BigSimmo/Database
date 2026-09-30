import { describe, expect, it } from "vitest";

import { toolCatalogRecordsForSession } from "@/lib/tools-catalog";
import {
  defaultPinnedToolIds,
  groupToolsForPage,
  maxPinnedTools,
  readPinnedToolIds,
  togglePinnedToolId,
  toolLaunchNoteById,
} from "@/lib/tools-page-layout";

describe("Tools page grouping", () => {
  const tools = toolCatalogRecordsForSession({ authenticated: true, demoMode: false });

  it("places every catalogue tool in exactly one group", () => {
    const placed = groupToolsForPage(tools).flatMap((entry) => entry.tools.map((tool) => tool.id));
    expect(placed.sort()).toEqual(tools.map((tool) => tool.id).sort());
  });

  it("leads with the safety tools", () => {
    const [first] = groupToolsForPage(tools);
    expect(first.group.id).toBe("safety");
    expect(first.tools.map((tool) => tool.id)).toEqual(["risk-safety", "safety-plan"]);
  });

  it("drops a group whose tools are all hidden, such as Saved for a guest", () => {
    const guestTools = toolCatalogRecordsForSession({ authenticated: false, demoMode: false });
    expect(groupToolsForPage(guestTools).map((entry) => entry.group.id)).not.toContain("saved");
  });

  it("labels every entry that opens another mode rather than a tool of its own", () => {
    for (const tool of tools) {
      const opensAsk = tool.href.startsWith("/?mode=answer&");
      if (opensAsk) expect(toolLaunchNoteById[tool.id]).toBe("Opens Ask with a starter question");
    }
    expect(toolLaunchNoteById.guidelines).toMatch(/Documents/);
  });
});

describe("Tools page pins", () => {
  it("uses the defaults when nothing is stored or the value is unreadable", () => {
    expect(readPinnedToolIds(null)).toEqual([...defaultPinnedToolIds]);
    expect(readPinnedToolIds("not json")).toEqual([...defaultPinnedToolIds]);
    expect(readPinnedToolIds('{"a":1}')).toEqual([...defaultPinnedToolIds]);
  });

  it("keeps an intentionally empty pin list", () => {
    expect(readPinnedToolIds("[]")).toEqual([]);
  });

  it("drops unknown and duplicate ids and caps the list", () => {
    expect(readPinnedToolIds('["forms","nope","forms","services","documents","calculators","monitoring"]')).toEqual([
      "forms",
      "services",
      "documents",
      "calculators",
    ]);
  });

  it("toggles a pin on and off, dropping the oldest when full", () => {
    expect(togglePinnedToolId(["forms"], "forms")).toEqual([]);
    expect(togglePinnedToolId(["forms"], "services")).toEqual(["forms", "services"]);
    const full = ["forms", "services", "documents", "calculators"] as const;
    expect(full).toHaveLength(maxPinnedTools);
    expect(togglePinnedToolId(full, "monitoring")).toEqual(["services", "documents", "calculators", "monitoring"]);
  });
});
