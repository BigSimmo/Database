"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import { cn, floatingControl } from "@/components/ui-primitives";

/**
 * A long list shows a first batch, then "Show all". The shared standard's §4 says
 * "about eight rows" before "Show all" (spec rule 12 and the shared standard agree).
 * One number, here, so every Admin list agrees.
 */
export const ADMIN_LIST_PREVIEW_ROWS = 8;

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash.slice(1);
const noHashOnServer = () => "";

/**
 * A redirected bookmark (`#on-call-entry-<id>`, Review Focus 2) must still land
 * when its row is past the first batch, so the list opens in full when the
 * address's anchor names a hidden row. Worked out on every render from the
 * current items and the current hash (M5), not once at mount: the items are
 * often still arriving when the list first renders.
 */
export function AdminShowAll<T>({
  items,
  renderItem,
  anchorIdOf,
  label,
  testId,
  previewRows = ADMIN_LIST_PREVIEW_ROWS,
  showCount = false,
  expandAll = false,
  listClassName,
}: {
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  anchorIdOf?: (item: T) => string;
  label: string;
  testId: string;
  /** Rows shown before "Show all". Defaults to the shared Admin number. */
  previewRows?: number;
  /** Name the full count on the control: "Show all 14". */
  showCount?: boolean;
  /** Open in full regardless of the reader (e.g. before printing). */
  expandAll?: boolean;
  /** Extra classes for the list itself, e.g. a card surface. */
  listClassName?: string;
}) {
  const [openedByReader, setExpanded] = useState(false);
  const hash = useSyncExternalStore(subscribeToHash, readHash, noHashOnServer);
  const anchoredRowHidden =
    anchorIdOf !== undefined && hash !== "" && items.slice(previewRows).some((item) => anchorIdOf(item) === hash);
  const expanded = openedByReader || anchoredRowHidden || expandAll;
  const shown = expanded ? items : items.slice(0, previewRows);
  return (
    <>
      <ul className={cn("grid", listClassName)} aria-label={label} data-testid={testId}>
        {shown.map(renderItem)}
      </ul>
      {!expanded && items.length > previewRows ? (
        <button
          type="button"
          className={floatingControl}
          onClick={() => setExpanded(true)}
          data-testid={`${testId}-show-all`}
        >
          {showCount ? `Show all ${items.length}` : "Show all"}
        </button>
      ) : null}
    </>
  );
}
