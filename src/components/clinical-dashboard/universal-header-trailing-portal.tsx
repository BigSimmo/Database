"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { universalHeaderTrailingSlotId } from "@/lib/mode-home-composer";

/**
 * Moves one page-owned control into the universal header's trailing region, in
 * place of the new-chat button.
 *
 * The sibling of `PhoneHeaderCollapsePortal`, and the same mechanism for the
 * same reason: the shell renders above the page, so a page cannot hand it a
 * prop, and a `searchMode === "…"` branch inside the header is how one row
 * becomes sixteen variants. `globals.css` stands the new-chat button down while
 * this slot is occupied, so the region still holds exactly one control.
 *
 * Unlike the collapse portal there is no width condition: the control belongs in
 * the header at every size, because the button it replaces is there at every
 * size.
 *
 * Renders NOTHING when the host is absent — a standalone page with no universal
 * header, a test that mounts the page alone. A page-owned header control has no
 * meaningful in-flow fallback position: dropped into the page body it would read
 * as page content and, on this mode, would duplicate actions the section already
 * offers inline. The collapse portal returns its children in that case because a
 * navigation header genuinely does have a sensible in-flow position; this does
 * not.
 */
export function UniversalHeaderTrailingPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const sync = () => {
      const nextHost = document.getElementById(universalHeaderTrailingSlotId);
      setHost((current) => (current === nextHost ? current : nextHost));
    };

    sync();
    // The header can mount, unmount and remount around this page — a shell swap,
    // a route transition — so the host is watched rather than resolved once.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return host ? createPortal(children, host) : null;
}
