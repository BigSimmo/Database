import type { ReactNode } from "react";

import { TeachingSampleBanner } from "@/components/teaching/teaching-sample-banner";
import { teachingSampleOn } from "@/lib/teaching/sample";

/** While this browser is in the Teaching sample, every Teaching page says so and offers the way out. */
export default async function TeachingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {(await teachingSampleOn()) ? <TeachingSampleBanner /> : null}
      {children}
    </>
  );
}
