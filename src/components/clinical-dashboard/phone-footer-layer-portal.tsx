"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PhoneFooterLayerContextValue {
  host: HTMLElement | null;
  scrollHidden: boolean | undefined;
}

const PhoneFooterLayerContext = createContext<PhoneFooterLayerContextValue>({
  host: null,
  scrollHidden: undefined,
});

/**
 * Provides one paint-free footer host inside the current phone viewport frame.
 * The host is rendered after the frame's scroll surface so standalone footer
 * layers can anchor to the frame instead of scrolling with page content.
 */
export function PhoneFooterLayerFrame({
  children,
  className,
  scrollHidden,
}: {
  children: ReactNode;
  className: string;
  scrollHidden?: boolean;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const assignHost = useCallback((node: HTMLDivElement | null) => {
    setHost((current) => (current === node ? current : node));
  }, []);
  const contextValue = useMemo(() => ({ host, scrollHidden }), [host, scrollHidden]);

  return (
    <PhoneFooterLayerContext.Provider value={contextValue}>
      <div className={className}>
        {children}
        <div ref={assignHost} className="phone-footer-layer-host contents" data-testid="phone-footer-layer-host" />
      </div>
    </PhoneFooterLayerContext.Provider>
  );
}

/** Authoritative frame scroll decision for page-owned phone footer layers. */
export function usePhoneFooterLayerScrollHidden() {
  return useContext(PhoneFooterLayerContext).scrollHidden;
}

/**
 * Moves a page-owned footer into the current viewport frame on phones. At sm+
 * (and when rendered outside a shell) the same subtree remains inline, keeping
 * existing tablet/desktop placement and a safe shell-less fallback.
 */
export function PhoneFooterLayerPortal({ children }: { children: ReactNode }) {
  const { host } = useContext(PhoneFooterLayerContext);
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
