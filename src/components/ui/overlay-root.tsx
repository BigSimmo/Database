"use client";

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type OverlayLayer = "overlay" | "popover" | "modal" | "toast";

const LAYERS: readonly OverlayLayer[] = ["overlay", "popover", "modal", "toast"];
const Z_INDEX: Record<OverlayLayer, string> = {
  overlay: "var(--z-overlay)",
  popover: "var(--z-popover)",
  modal: "var(--z-modal)",
  toast: "var(--z-toast)",
};

let mountedRoots = 0;

function OverlayHost({ layer }: { layer: OverlayLayer }) {
  return (
    <div
      data-overlay-host={layer}
      style={{ position: "fixed", inset: 0, zIndex: Z_INDEX[layer], pointerEvents: "none" }}
    />
  );
}

/** Mount once near the application root when the controller lane can edit layout.tsx. */
export function OverlayRoot() {
  useEffect(() => {
    mountedRoots += 1;
    if (mountedRoots > 1 && process.env.NODE_ENV !== "production") {
      mountedRoots -= 1;
      throw new Error("Only one <OverlayRoot> may be mounted.");
    }
    return () => {
      mountedRoots -= 1;
    };
  }, []);

  return (
    <div data-overlay-root="true">
      {LAYERS.map((layer) => (
        <OverlayHost key={layer} layer={layer} />
      ))}
    </div>
  );
}

function getOverlayHost(layer: OverlayLayer) {
  if (typeof document === "undefined") return null;
  // Prefer the layout-mounted OverlayRoot over a synthetic fallback created
  // before it. A bare querySelector would keep consumers stuck on the first
  // host forever once both exist in the document.
  const preferred = document.querySelector<HTMLElement>(`[data-overlay-root="true"] [data-overlay-host="${layer}"]`);
  if (preferred) return preferred;
  return document.querySelector<HTMLElement>(`[data-overlay-host="${layer}"]`);
}

function ensureFallbackHost(layer: OverlayLayer) {
  const existing = getOverlayHost(layer);
  if (existing) return existing;

  let root = document.querySelector<HTMLElement>('[data-overlay-root="fallback"]');
  if (!root) {
    root = document.createElement("div");
    root.dataset.overlayRoot = "fallback";
    document.body.append(root);
    for (const fallbackLayer of LAYERS) {
      const host = document.createElement("div");
      host.dataset.overlayHost = fallbackLayer;
      Object.assign(host.style, {
        position: "fixed",
        inset: "0",
        zIndex: Z_INDEX[fallbackLayer],
        pointerEvents: "none",
      });
      root.append(host);
    }
  }
  return root.querySelector<HTMLElement>(`[data-overlay-host="${layer}"]`)!;
}

function getServerOverlayHost() {
  return null;
}

export type OverlayPortalProps =
  | { layer: "modal"; name: string; children: ReactNode }
  | { layer: Exclude<OverlayLayer, "modal">; name?: string; children: ReactNode };

export function OverlayPortal({ layer, name, children }: OverlayPortalProps) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof document === "undefined") return () => undefined;
      // Ensure a host exists for the first paint, then observe host swaps so a
      // late-mounted <OverlayRoot> (or fallback teardown) re-portals consumers.
      ensureFallbackHost(layer);
      onStoreChange();
      const observer = new MutationObserver(() => {
        onStoreChange();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-overlay-host", "data-overlay-root"],
      });
      return () => observer.disconnect();
    },
    [layer],
  );
  const getSnapshot = useCallback(() => getOverlayHost(layer), [layer]);
  const host = useSyncExternalStore(subscribe, getSnapshot, getServerOverlayHost);

  if (!host) return null;
  return createPortal(
    <div
      data-overlay-layer={layer}
      data-overlay-name={name}
      style={{ display: "contents", pointerEvents: layer === "modal" ? "auto" : "none" }}
    >
      {children}
    </div>,
    host,
  );
}
