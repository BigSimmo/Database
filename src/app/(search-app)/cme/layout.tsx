import type { ReactNode } from "react";

/**
 * A pass-through. It exists to give the CME namespace a route boundary of its
 * own — nothing more; every screen in the mode owns its own frame.
 */
export default function CmeLayout({ children }: { children: ReactNode }) {
  return children;
}
