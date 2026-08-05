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

function ensureFallbackHost(layer: OverlayLayer) {
  const existing = document.querySelector<HTMLElement>(`[data-overlay-host="${layer}"]`);
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

function getOverlayHost(layer: OverlayLayer) {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[data-overlay-host="${layer}"]`);
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
      ensureFallbackHost(layer);
      onStoreChange();
      return () => undefined;
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
