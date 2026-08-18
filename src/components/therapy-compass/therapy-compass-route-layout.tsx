"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const THERAPY_HOME = "/therapy-compass";
const TherapyCompassWorkspace = dynamic(() => import("./workspace").then((module) => module.TherapyCompassWorkspace));

/**
 * Route-local client boundary for Therapy's catalogue workspace.
 *
 * The home remains the lightweight shared ModeHomeTemplate surface and must not
 * mount the full catalogue provider. Every richer child route keeps the provider
 * mounted across client navigation without teaching the global shell about one
 * mode's private state.
 */
export function TherapyCompassRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === THERAPY_HOME) return children;
  return <TherapyCompassWorkspace>{children}</TherapyCompassWorkspace>;
}
