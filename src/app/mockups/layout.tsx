import type { ReactNode } from "react";

import { GlobalMockupSearchShell } from "@/components/clinical-dashboard/global-mockup-search-shell";

export default function MockupsLayout({ children }: { children: ReactNode }) {
  return <GlobalMockupSearchShell>{children}</GlobalMockupSearchShell>;
}
