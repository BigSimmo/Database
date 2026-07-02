import type { ReactNode } from "react";

import { GlobalSearchShell } from "@/components/clinical-dashboard/global-search-shell";

export default function FavouritesLayout({ children }: { children: ReactNode }) {
  return (
    <GlobalSearchShell initialMode="favourites" availableModeIds={["favourites"]}>
      {children}
    </GlobalSearchShell>
  );
}
