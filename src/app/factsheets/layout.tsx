import type { ReactNode } from "react";

import { FactsheetShell } from "@/components/factsheets/factsheet-shell";

export default function FactsheetsLayout({ children }: { children: ReactNode }) {
  return <FactsheetShell>{children}</FactsheetShell>;
}
