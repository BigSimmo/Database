import type { ComponentProps } from "react";

import { ModeHeroLink } from "@/components/mode-kit/hero-link";

/**
 * The shared raised link card (`src/components/mode-kit/hero-link.tsx`), tinted
 * On Call teal when `featured`. Use `featured` once per screen, for Now's
 * "Who do I call now?".
 */
export function OnCallHeroLink(props: Omit<ComponentProps<typeof ModeHeroLink>, "mode">) {
  return <ModeHeroLink {...props} mode="on-call" />;
}
