import type { AppModeId } from "@/lib/app-modes";
import { serviceRecordSearchText, type ServiceRecord } from "@/lib/service-ranker";

export type CommandScopeChip = {
  id: string;
  label: string;
};

export type CommandSuggestion = {
  text: string;
  meta: string;
};

export type SearchCommandSurfaceConfig = {
  examples: string[];
  suggestions: CommandSuggestion[];
  scopes: CommandScopeChip[];
  crossModes: AppModeId[];
};

export type CommandSurfacePlacement = "bottom-dock" | "inline";

export function commandDropdownMinimumWidthMediaQuery(placement: CommandSurfacePlacement) {
  const minimumWidth = placement === "bottom-dock" ? "640px" : "1024px";
  return `(min-width: ${minimumWidth})`;
}

export const commandDropdownPointerMediaQuery = "(hover: hover) and (pointer: fine)";

/**
 * The command panel is a desktop enhancement. Width alone is not enough to
 * identify that environment: phones can report a wide viewport in landscape,
 * display-zoom, or desktop-site modes. A fine pointer enables the panel on
 * hybrid desktops; a zero-touch fallback keeps headless/remote desktops usable
 * when the browser reports no pointer hardware at all.
 */
export function commandDropdownCanDisplay({
  minimumWidthMatches,
  pointerMatches,
  maxTouchPoints,
}: {
  minimumWidthMatches: boolean;
  pointerMatches: boolean;
  maxTouchPoints: number;
}) {
  return minimumWidthMatches && (pointerMatches || maxTouchPoints === 0);
}

const searchCommandSurfaceByMode: Partial<Record<AppModeId, SearchCommandSurfaceConfig>> = {
  documents: {
    examples: ["clozapine ANC thresholds", "lithium monitoring table", "QT prolongation quote"],
    suggestions: [
      { text: "clozapine monitoring table", meta: "Tables" },
      { text: "clozapine ANC thresholds", meta: "Guidelines" },
      { text: "clozapine rechallenge criteria", meta: "Quotes" },
    ],
    scopes: [
      { id: "guidelines", label: "Guidelines" },
      { id: "tables", label: "Tables" },
      { id: "quotes", label: "Quotes" },
      { id: "current", label: "Current only" },
    ],
    crossModes: ["prescribing", "forms", "favourites"],
  },
  services: {
    examples: ["crisis ATSI phone WA", "perinatal psychiatry metro", "older adult CMH Fremantle"],
    suggestions: [
      { text: "crisis phone referral", meta: "Route" },
      { text: "crisis ATSI-specific", meta: "Eligibility" },
      { text: "crisis free statewide", meta: "Cost" },
    ],
    scopes: [
      { id: "crisis", label: "Crisis" },
      { id: "atsi", label: "ATSI-specific" },
      { id: "free", label: "Free" },
      { id: "phone", label: "Phone referral" },
      { id: "region", label: "My region" },
    ],
    crossModes: ["documents", "favourites", "forms"],
  },
  forms: {
    examples: ["transport order", "Form 3A detention", "extension of transport"],
    suggestions: [
      { text: "transport order form 4A", meta: "Forms" },
      { text: "transport order extension 4B", meta: "Forms" },
      { text: "transport pathway PSOLIS", meta: "Pathways" },
    ],
    scopes: [
      { id: "highrisk", label: "High risk" },
      { id: "official", label: "Official only" },
      { id: "pathway", label: "Pathway-linked" },
    ],
    crossModes: ["documents", "services", "favourites"],
  },
  differentials: {
    examples: ["acute confusion", "first episode psychosis", "catatonia vs NMS"],
    suggestions: [
      { text: "acute confusion / encephalopathy", meta: "Presentation" },
      { text: "confusion post-ictal", meta: "Presentation" },
      { text: "confusion Wernicke risk", meta: "Red flag" },
    ],
    scopes: [
      { id: "emergent", label: "Emergent only" },
      { id: "compare", label: "Compare mode" },
    ],
    crossModes: ["documents", "prescribing", "forms"],
  },
  dsm: {
    examples: ["major depressive disorder", "F31.81", "panic disorder criteria"],
    suggestions: [
      { text: "major depressive disorder", meta: "Diagnosis" },
      { text: "bipolar II disorder", meta: "Compare" },
      { text: "posttraumatic stress disorder", meta: "Criteria" },
    ],
    scopes: [],
    crossModes: ["differentials", "prescribing", "documents"],
  },
  prescribing: {
    examples: ["acamprosate renal", "naltrexone dose ceiling", "disulfiram counselling"],
    suggestions: [
      { text: "acamprosate renal dosing", meta: "Safety" },
      { text: "acamprosate ceiling 1,998 mg/day", meta: "Dose" },
      { text: "acamprosate vs naltrexone", meta: "Compare" },
    ],
    scopes: [
      { id: "indication", label: "Indication" },
      { id: "safety", label: "Safety" },
      { id: "monitor", label: "Monitoring" },
      { id: "renal", label: "Renal dose" },
    ],
    crossModes: ["documents", "differentials", "favourites"],
  },
  favourites: {
    examples: ["ward round set", "pinned monitoring tables", "clozapine clinic"],
    suggestions: [
      { text: "ward round set", meta: "Sets" },
      { text: "ward round medication pages", meta: "Items" },
      { text: "ward round renal checks", meta: "Items" },
    ],
    scopes: [
      { id: "pinned", label: "Pinned" },
      { id: "source", label: "Source-backed" },
      { id: "recent", label: "Recently used" },
    ],
    crossModes: ["documents", "prescribing", "services"],
  },
  answer: {
    examples: ["lithium level timing", "clozapine ANC monitoring", "ECT consent requirements"],
    suggestions: [
      { text: "lithium monitoring intervals", meta: "Guidelines" },
      { text: "clozapine rechallenge criteria", meta: "Safety" },
      { text: "QT prolongation risk medicines", meta: "Prescribing" },
    ],
    scopes: [],
    // Keep in sync with the post-answer cross-mode links strip, which covers
    // prescribing, services, forms, and differentials.
    crossModes: ["documents", "prescribing", "services", "forms", "differentials"],
  },
  specifiers: {
    examples: ["depressed but racing thoughts", "returns every winter", "much better but not fully recovered"],
    suggestions: [
      { text: "depressed but racing thoughts", meta: "Episode features" },
      { text: "returns every winter", meta: "Course and onset" },
      { text: "much better but not fully recovered", meta: "Severity and remission" },
    ],
    scopes: [],
    crossModes: ["dsm", "differentials", "formulation", "documents"],
  },
  formulation: {
    examples: ["avoidance after panic", "rumination after rejection", "dissociation under threat"],
    suggestions: [
      { text: "avoidance after panic", meta: "Mechanism" },
      { text: "rumination after rejection", meta: "Pattern" },
      { text: "dissociation under threat", meta: "Clinical clue" },
    ],
    scopes: [],
    crossModes: ["differentials", "documents", "answer"],
  },
  tools: {
    examples: ["renal calculator", "dose converter", "clinical forms"],
    suggestions: [
      { text: "renal function calculator", meta: "Calculator" },
      { text: "dose converter", meta: "Medication tool" },
      { text: "clinical forms", meta: "Directory" },
    ],
    scopes: [],
    crossModes: ["documents", "prescribing", "forms", "favourites"],
  },
};

export function searchCommandSurfaceConfig(modeId: AppModeId): SearchCommandSurfaceConfig | null {
  return searchCommandSurfaceByMode[modeId] ?? null;
}

export const differentialRedFlagTerms = ["confusion", "overdose", "suicid", "chest pain", "unresponsive", "catatoni"];

export function isFormCodeQuery(query: string) {
  const codeQuery = query.replace(/^form\s+/i, "").trim();
  return /^\d{1,2}[a-z]?$/i.test(codeQuery);
}

export function filteredSuggestions(config: SearchCommandSurfaceConfig, query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return config.suggestions.filter(
    (entry) =>
      entry.text.toLowerCase().includes(trimmed) ||
      trimmed.split(/\s+/).every((token) => entry.text.toLowerCase().includes(token)),
  );
}

function serviceScopeMatches(record: ServiceRecord, text: string, scope: string) {
  switch (scope) {
    case "crisis":
      return (
        /crisis|urgent|emergency/.test(text) ||
        record.statusChips?.some((chip) => /crisis|urgent/i.test(chip.label ?? "")) === true
      );
    case "atsi":
      return /atsi|aboriginal|torres strait|13yarn/i.test(text);
    case "free":
      return /free/i.test(record.cost ?? text);
    case "phone":
      return (
        /phone|self referral|call/i.test(`${record.route ?? ""} ${record.referral ?? ""} ${text}`) ||
        record.primaryContact?.kind === "phone"
      );
    case "region":
      return (
        Boolean(record.catchments?.length) || /regional|metro|statewide|wa|national/i.test(record.location ?? text)
      );
    default:
      return true;
  }
}

function formScopeMatches(record: ServiceRecord, text: string, scope: string) {
  switch (scope) {
    case "highrisk":
      return (
        /high risk|danger/.test(text) ||
        record.statusChips?.some((chip) => /high risk/i.test(chip.label ?? "")) === true
      );
    case "official":
      return /official|template|mha|act/i.test(text);
    case "pathway":
      return /pathway|psolis|linked/i.test(text);
    default:
      return true;
  }
}

export function recordMatchesCommandScopes(record: ServiceRecord, scopes: string[], modeId: AppModeId) {
  if (!scopes.length) return true;
  const text = serviceRecordSearchText(record);
  return scopes.every((scope) => {
    if (modeId === "services") return serviceScopeMatches(record, text, scope);
    if (modeId === "forms") return formScopeMatches(record, text, scope);
    return true;
  });
}

export type FavouriteScopeItem = {
  pinned?: boolean;
  evidence: string;
  lastUsed: string;
};

export function favouriteMatchesCommandScopes(item: FavouriteScopeItem, scopes: string[]) {
  if (!scopes.length) return true;
  return scopes.every((scope) => {
    switch (scope) {
      case "pinned":
        return item.pinned === true;
      case "source":
        return Boolean(item.evidence && item.evidence !== "Run" && item.evidence !== "Saved query");
      case "recent":
        return item.lastUsed.toLowerCase().startsWith("today") || item.lastUsed.toLowerCase().startsWith("yesterday");
      default:
        return true;
    }
  });
}

export type MedicationScopeItem = {
  indication: string;
  match: string;
  dose: string;
  ceiling: string;
  action: string;
};

export function medicationMatchesCommandScopes(item: MedicationScopeItem, scopes: string[]) {
  if (!scopes.length) return true;
  const haystack = `${item.indication} ${item.match} ${item.dose} ${item.ceiling} ${item.action}`.toLowerCase();
  return scopes.every((scope) => {
    switch (scope) {
      case "indication":
        return /indication|abstinence|maintenance|opioid|alcohol/.test(haystack);
      case "safety":
        return /check|avoid|caution|contraind|renal|hepatic/.test(haystack);
      case "monitor":
        return /monitor|follow|baseline|level|function/.test(haystack);
      case "renal":
        return /renal|creatinine|dose adjust|mg\/day|ceiling/.test(haystack);
      default:
        return true;
    }
  });
}
