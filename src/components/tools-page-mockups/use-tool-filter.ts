import { useMemo, useState } from "react";

import { areaLabels, pinnedToolIds, statusLabels, type ToolFixture } from "./tool-fixtures";

export type ToolFilterId = "all" | "pinned" | "review_due" | "source_backed" | "clinical" | "admin" | "recent";

type ToolFilterCounts = Record<ToolFilterId, number>;

const clinicalAreas = new Set(["reference", "assessment", "care"]);
const adminAreas = new Set(["coordination", "personal"]);

function matchesFilter(tool: ToolFixture, filterId: ToolFilterId) {
  if (filterId === "all") return true;
  if (filterId === "pinned") return pinnedToolIds.includes(tool.id as (typeof pinnedToolIds)[number]);
  if (filterId === "review_due") return tool.status === "review_due";
  if (filterId === "source_backed") return tool.sourceBacked;
  if (filterId === "clinical") return clinicalAreas.has(tool.area);
  if (filterId === "admin") return adminAreas.has(tool.area);
  if (filterId === "recent") return tool.status === "recent";
  return true;
}

function matchesQuery(tool: ToolFixture, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    tool.title,
    tool.description,
    tool.primaryAction,
    tool.secondary,
    tool.lastUsed,
    areaLabels[tool.area],
    statusLabels[tool.status],
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function countTools(tools: ToolFixture[]): ToolFilterCounts {
  return {
    admin: tools.filter((tool) => matchesFilter(tool, "admin")).length,
    all: tools.length,
    clinical: tools.filter((tool) => matchesFilter(tool, "clinical")).length,
    pinned: tools.filter((tool) => matchesFilter(tool, "pinned")).length,
    recent: tools.filter((tool) => matchesFilter(tool, "recent")).length,
    review_due: tools.filter((tool) => matchesFilter(tool, "review_due")).length,
    source_backed: tools.filter((tool) => matchesFilter(tool, "source_backed")).length,
  };
}

export function useToolFilter(tools: ToolFixture[]) {
  const [query, setQuery] = useState("");
  const [filterId, setFilterId] = useState<ToolFilterId>("all");

  const counts = useMemo(() => countTools(tools), [tools]);
  const filtered = useMemo(
    () => tools.filter((tool) => matchesFilter(tool, filterId) && matchesQuery(tool, query)),
    [filterId, query, tools],
  );

  return {
    counts,
    filterId,
    filtered,
    query,
    reset: () => {
      setFilterId("all");
      setQuery("");
    },
    setQuery,
    toggleFilter: (nextFilterId: ToolFilterId) => {
      setFilterId((currentFilterId) => (currentFilterId === nextFilterId ? "all" : nextFilterId));
    },
  };
}
