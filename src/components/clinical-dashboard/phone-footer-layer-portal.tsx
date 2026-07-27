"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PhoneFooterLayerHostContext = createContext<HTMLElement | null>(null);

/**
 * Provides one paint-free footer host inside the current phone viewport frame.
 * The host is rendered after the frame's scroll surface so standalone footer
 * layers can anchor to the frame instead of scrolling with page content.
 */
export function PhoneFooterLayerFrame({ children, className }: { children: ReactNode; className: string }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const assignHost = useCallback((node: HTMLDivElement | null) => {
    setHost((current) => (current === node ? current : node));
  }, []);

  return (
    <PhoneFooterLayerHostContext.Provider value={host}>
      <div className={className}>
        {children}
        <div ref={assignHost} className="phone-footer-layer-host contents" data-testid="phone-footer-layer-host" />
      </div>
    </PhoneFooterLayerHostContext.Provider>
  );
}

/**
 * Moves a page-owned footer into the current viewport frame on phones. At sm+
 * (and when rendered outside a shell) the same subtree remains inline, keeping
 * existing tablet/desktop placement and a safe shell-less fallback.
 */
export function PhoneFooterLayerPortal({ children }: { children: ReactNode }) {
  const host = useContext(PhoneFooterLayerHostContext);
  const [isPhone, setIsPhone] = useState(false);

  useLayoutEffect(() => {
    const phoneMedia = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsPhone(phoneMedia.matches);

    sync();
    phoneMedia.addEventListener("change", sync);
    return () => phoneMedia.removeEventListener("change", sync);
  }, []);

  return isPhone && host ? createPortal(children, host) : children;
}
