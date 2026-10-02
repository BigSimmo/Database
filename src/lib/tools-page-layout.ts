import { medicationEntitiesInText } from "@/lib/medication-entities";
import type { ToolCatalogArea, ToolCatalogId, ToolCatalogRecord } from "@/lib/tools-catalog";

/**
 * How the Tools page arranges the catalogue: by the job a clinician is doing,
 * with safety tools pulled out of the list so they are never behind a filter.
 *
 * Grouping used to be a filter over `area`. Fifteen tools do not need a
 * filter, and filtering hid the safety tools whenever another category was
 * selected. Both records below are keyed by `ToolCatalogId`, so adding a tool
 * without deciding where it sits fails the typecheck instead of dropping it
 * off the page.
 */
export type ToolPageGroupId = "safety" | "lookup" | "assess" | "treat" | "coordinate" | "saved";

export type ToolPageGroup = {
  id: ToolPageGroupId;
  label: string;
  /** The area whose accent the group heading wears. Safety has its own band styling instead. */
  accentArea: ToolCatalogArea | null;
};

export const toolPageGroups: readonly ToolPageGroup[] = [
  { id: "safety", label: "Safety", accentArea: null },
  { id: "lookup", label: "Look it up", accentArea: "reference" },
  { id: "assess", label: "Assess", accentArea: "assessment" },
  { id: "treat", label: "Treat and plan", accentArea: "care" },
  { id: "coordinate", label: "Coordinate", accentArea: "coordination" },
  { id: "saved", label: "Saved", accentArea: "saved" },
];

export const toolPageGroupById: Record<ToolCatalogId, ToolPageGroupId> = {
  "risk-safety": "safety",
  "safety-plan": "safety",
  "clinical-kb-search": "lookup",
  documents: "lookup",
  guidelines: "lookup",
  "clinical-dictionary": "lookup",
  "source-catalogue": "lookup",
  differentials: "assess",
  calculators: "assess",
  "medication-prescribing": "treat",
  "care-plans": "treat",
  monitoring: "treat",
  services: "coordinate",
  forms: "coordinate",
  favourites: "saved",
};

/**
 * Says plainly when a "tool" is really a shortcut into another mode, so the
 * clinician is not surprised to land in Ask or Documents. `null` means the
 * entry opens a tool of its own.
 */
export const toolLaunchNoteById: Record<ToolCatalogId, string | null> = {
  "risk-safety": "Opens Ask with a starter question",
  "care-plans": "Opens Ask with a starter question",
  monitoring: "Opens Ask with a starter question",
  guidelines: "Opens Documents filtered to guidelines",
  "safety-plan": "Template, no source citations",
  "clinical-kb-search": null,
  documents: null,
  "clinical-dictionary": null,
  "source-catalogue": null,
  differentials: null,
  calculators: null,
  "medication-prescribing": null,
  services: null,
  forms: null,
  favourites: null,
};

export type GroupedTools = { group: ToolPageGroup; tools: ToolCatalogRecord[] };

/** Groups the given tools in page order, keeping catalogue order within a group and dropping empty groups. */
export function groupToolsForPage(tools: readonly ToolCatalogRecord[]): GroupedTools[] {
  return toolPageGroups
    .map((group) => ({ group, tools: tools.filter((tool) => toolPageGroupById[tool.id] === group.id) }))
    .filter((entry) => entry.tools.length > 0);
}

export const TOOL_PINS_STORAGE_KEY = "psychsift-tool-pins";

export const defaultPinnedToolIds = [
  "medication-prescribing",
  "calculators",
  "safety-plan",
  "favourites",
] as const satisfies readonly ToolCatalogId[];

/** At most one row of pins on a phone. */
export const maxPinnedTools = 4;

const knownToolIds = new Set<string>(Object.keys(toolPageGroupById));

/** Parses a stored pin list. Missing or malformed values fall back to the defaults; unknown ids are dropped. */
export function readPinnedToolIds(storedValue: string | null | undefined): ToolCatalogId[] {
  if (storedValue === null || storedValue === undefined) return [...defaultPinnedToolIds];
  let parsed: unknown;
  try {
    parsed = JSON.parse(storedValue);
  } catch {
    return [...defaultPinnedToolIds];
  }
  if (!Array.isArray(parsed)) return [...defaultPinnedToolIds];
  const seen = new Set<ToolCatalogId>();
  for (const candidate of parsed) {
    if (typeof candidate !== "string" || !knownToolIds.has(candidate)) continue;
    seen.add(candidate as ToolCatalogId);
    if (seen.size === maxPinnedTools) break;
  }
  return [...seen];
}

/** Adds or removes a pin. Adding past the limit drops the oldest pin rather than refusing. */
export function togglePinnedToolId(current: readonly ToolCatalogId[], id: ToolCatalogId): ToolCatalogId[] {
  if (current.includes(id)) return current.filter((candidate) => candidate !== id);
  return [...current, id].slice(-maxPinnedTools);
}

/**
 * Tool ranking only knows each tool's own keywords, so a medicine name such as
 * "clozapine" matched nothing. When the query names a known medicine, lead with
 * Medication Prescribing, drawn from the session's own tools so gating still holds.
 */
export function withMedicineMatch(
  matched: readonly ToolCatalogRecord[],
  query: string,
  sessionTools: readonly ToolCatalogRecord[],
): ToolCatalogRecord[] {
  const prescribing = sessionTools.find((tool) => tool.id === "medication-prescribing");
  if (!prescribing || medicationEntitiesInText(query).length === 0) return [...matched];
  return [prescribing, ...matched.filter((tool) => tool.id !== prescribing.id)];
}
