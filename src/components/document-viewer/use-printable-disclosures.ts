"use client";

import { useEffect } from "react";

type DisclosureState = {
  name: string | null;
  open: boolean;
};

export function usePrintableDisclosures() {
  useEffect(() => {
    const previousStates = new Map<HTMLDetailsElement, DisclosureState>();
    const expand = () => {
      if (previousStates.size) return;
      const disclosures = window.document.querySelectorAll<HTMLDetailsElement>(
        'details.source-print, details[name="document-viewer-section"]',
      );
      disclosures.forEach((disclosure) => {
        previousStates.set(disclosure, {
          name: disclosure.getAttribute("name"),
          open: disclosure.open,
        });
        disclosure.removeAttribute("name");
        disclosure.open = true;
      });
    };
    const restore = () => {
      const connected = [...previousStates].filter(([disclosure]) => disclosure.isConnected);
      connected.forEach(([disclosure]) => {
        disclosure.open = false;
      });
      connected.forEach(([disclosure, previous]) => {
        if (previous.name === null) disclosure.removeAttribute("name");
        else disclosure.setAttribute("name", previous.name);
        disclosure.open = previous.open;
      });
      previousStates.clear();
    };
    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);
    return () => {
      restore();
      window.removeEventListener("beforeprint", expand);
      window.removeEventListener("afterprint", restore);
    };
  }, []);
}
