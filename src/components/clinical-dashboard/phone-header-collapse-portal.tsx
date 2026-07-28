"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";

/**
 * Moves one page-owned navigation header into the universal phone collapse
 * track. The same subtree stays in normal flow at sm+ and when no shared host
 * exists, so routes never duplicate controls or lose their fallback header.
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

  return phoneHost ? createPortal(children, phoneHost) : children;
}
