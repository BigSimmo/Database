"use client";

import { useMemo } from "react";

import { SecondaryNavigation, type SecondaryNavigationItem } from "@/components/secondary-navigation";
import { modeSecondaryNavigationEntries } from "@/lib/mode-secondary-navigation";

import { useTcBindings } from "./bindings";

/** Core Therapy destinations for non-home workflow screens. */
export function TherapyCompassNav() {
  const b = useTcBindings();
  const actions = {
    "therapy-search": b.goSearch,
    "therapy-recommend": b.goRecommend,
    "therapy-compare": b.goCompare,
    "therapy-pathways": b.goPathways,
    "therapy-brief": b.goBrief,
    "therapy-sheets": b.goSheets,
  } as const;
  const activeId = b.isSearch
    ? "search"
    : b.isRecommend
      ? "recommend"
      : b.isCompare
        ? "compare"
        : b.isPathways
          ? "pathways"
          : b.isBrief
            ? "brief"
            : b.isSheets
              ? "sheets"
              : undefined;
  const items = modeSecondaryNavigationEntries("therapy-compass").map((entry) => ({
    kind: "action" as const,
    id: entry.id,
    label: entry.label,
    shortLabel: entry.shortLabel,
    current: entry.id === activeId,
    onSelect: entry.action && entry.action in actions ? actions[entry.action as keyof typeof actions] : b.goSearch,
  }));

  return (
    <SecondaryNavigation
      ariaLabel="Therapy mode"
      items={items}
      activeId={activeId}
      placeInShell
      className="tc-no-print"
    />
  );
}

export function TherapyInformationNavigation({ kind }: { kind: "detail" | "brief" | "sheet" }) {
  const b = useTcBindings();
  const items = useMemo<SecondaryNavigationItem[]>(() => {
    if (kind === "sheet") {
      return [
        { kind: "section", id: "builder", label: "Builder", targetId: "therapy-sheet-builder" },
        { kind: "section", id: "preview", label: "Preview", targetId: "therapy-sheet-preview" },
      ];
    }
    if (kind === "brief") {
      return [
        { kind: "section", id: "overview", label: "Overview", targetId: "therapy-brief-overview" },
        { kind: "section", id: "delivery", label: "Delivery steps", targetId: "therapy-brief-delivery" },
        ...(b.selectedTherapy?.clinicianScripts.length
          ? [
              {
                kind: "section" as const,
                id: "script",
                label: "Clinician script",
                targetId: "therapy-brief-script",
              },
            ]
          : []),
        { kind: "section", id: "before-use", label: "Before use", targetId: "therapy-brief-before-use" },
      ];
    }
    return [
      { kind: "section", id: "overview", label: "Overview", targetId: "therapy-overview" },
      { kind: "section", id: "use", label: "Use", targetId: "therapy-use" },
      { kind: "section", id: "delivery", label: "Delivery", targetId: "therapy-delivery" },
      { kind: "section", id: "safety", label: "Safety", targetId: "therapy-safety" },
      ...(b.relatedForSelected.length
        ? [{ kind: "section" as const, id: "related", label: "Related", targetId: "therapy-related" }]
        : []),
      { kind: "section", id: "sources", label: "Sources", targetId: "therapy-sources" },
    ];
  }, [b.relatedForSelected.length, b.selectedTherapy?.clinicianScripts.length, kind]);

  return <SecondaryNavigation ariaLabel="On this therapy page" items={items} placeInShell className="tc-no-print" />;
}
