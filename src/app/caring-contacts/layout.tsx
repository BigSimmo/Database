import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DeveloperAreaGate } from "@/components/developer-area/developer-area-gate";
import { PRIVATE_APP_ROBOTS_METADATA } from "@/lib/crawler-policy";

// This synthetic workspace is reachable only from the developer hub and is never indexed.
// Use the shared private-app robots object so this route does not emit a narrower child
// override beside the root noindex extras.
export const metadata: Metadata = {
  title: "Caring Contacts - PsychSift",
  robots: PRIVATE_APP_ROBOTS_METADATA,
};

export default function CaringContactsLayout({ children }: { children: ReactNode }) {
  return <DeveloperAreaGate>{children}</DeveloperAreaGate>;
}
