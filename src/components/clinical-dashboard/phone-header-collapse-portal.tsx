"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";

import { publishPhoneOverlayChromeReserveNow } from "./use-phone-overlay-chrome-reserve";

/**
 * Moves one page-owned navigation header into the universal phone collapse
 * track. The same subtree stays in normal flow at sm+ and when no shared host
 * exists, so routes never duplicate controls or lose their fallback header.
 *
 * Taking the subtree out of flow shortens the page by its height, so the reserve
 * that clears the fixed header has to grow in the SAME commit. Leaving that to
 * the reserve hook's geometry quiet window left every element 49px too high for
 * ~110ms, which is long enough for a tap to press one control and release on
 * another (#CHPC5C) — see `publishPhoneOverlayChromeReserveNow`.
 */
export function PhoneHeaderCollapsePortal({ children }: { children: ReactNode }) {
  const [phoneHost, setPhoneHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const phoneMedia = window.matchMedia("(max-width: 639px)");
    const sync = () => {
      const nextHost = phoneMedia.matches ? document.getElementById(phoneHeaderCollapseAddonSlotId) : null;
      setPhoneHost((current) => (current === nextHost ? current : nextHost));
    };

    sync();
    phoneMedia.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      phoneMedia.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  // Runs after the commit that resolved (or dropped) the host, so the stack it
  // measures already includes or excludes this subtree.
  //
  // Two things it does NOT do, both pinned in
  // tests/phone-overlay-reserve-portal-wiring.dom.test.tsx. On a cold first
  // load the publisher is suppressed outright — see its SCOPE LIMIT note. And
  // there is no cleanup, so unmounting this component leaves the reserve at the
  // taller value and holds content too low until the quiet window catches up;
  // a cleanup cannot simply publish, because React runs layout-effect destroys
  // before it detaches portal children, so it would measure the row it is
  // about to lose.
  useLayoutEffect(() => {
    publishPhoneOverlayChromeReserveNow();
  }, [phoneHost]);

  return phoneHost ? createPortal(children, phoneHost) : children;
}
