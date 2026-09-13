"use client";

import { Phone } from "lucide-react";

/**
 * The round call affordance the drawing puts at the end of every dialable row.
 *
 * A `<span>`, not a `<button>`. The row it sits in is already the `tel:` link,
 * so a real control here would be invalid markup inside an `<a>` and would
 * announce one action twice. The drawing's own `role="button"` on it is a
 * drawing, not a contract.
 */
export function OnCallCallDisc() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)]"
    >
      <Phone className="size-icon-sm" aria-hidden="true" />
    </span>
  );
}
