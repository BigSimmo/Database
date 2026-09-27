import type { ComponentProps } from "react";

import { ModeGroupedList } from "@/components/mode-kit/grouped-list";

export { ModeRow as OnCallRow } from "@/components/mode-kit/grouped-list";

/**
 * The shared grouped list (`src/components/mode-kit/grouped-list.tsx`), with its
 * header icon painted On Call teal.
 */
export function OnCallGroupedList(props: Omit<ComponentProps<typeof ModeGroupedList>, "mode">) {
  return <ModeGroupedList {...props} mode="on-call" />;
}
