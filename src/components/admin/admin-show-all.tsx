"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import { floatingControl } from "@/components/ui-primitives";

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
}: {
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  anchorIdOf?: (item: T) => string;
  label: string;
  testId: string;
}) {
  const [openedByReader, setExpanded] = useState(false);
  const hash = useSyncExternalStore(subscribeToHash, readHash, noHashOnServer);
  const anchoredRowHidden =
    anchorIdOf !== undefined &&
    hash !== "" &&
    items.slice(ADMIN_LIST_PREVIEW_ROWS).some((item) => anchorIdOf(item) === hash);
  const expanded = openedByReader || anchoredRowHidden;
  const shown = expanded ? items : items.slice(0, ADMIN_LIST_PREVIEW_ROWS);
  return (
    <>
      <ul className="grid" aria-label={label} data-testid={testId}>
        {shown.map(renderItem)}
      </ul>
      {!expanded && items.length > ADMIN_LIST_PREVIEW_ROWS ? (
        <button
          type="button"
          className={floatingControl}
          onClick={() => setExpanded(true)}
          data-testid={`${testId}-show-all`}
        >
          Show all
        </button>
      ) : null}
    </>
  );
}
