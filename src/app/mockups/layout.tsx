import type { ReactNode } from "react";

import { MockupsLayoutClient } from "./mockups-layout-client";

export default function MockupsLayout({ children }: { children: ReactNode }) {
  return <MockupsLayoutClient>{children}</MockupsLayoutClient>;
}
