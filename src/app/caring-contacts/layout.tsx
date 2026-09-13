import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PRIVATE_APP_ROBOTS_METADATA } from "@/lib/crawler-policy";

// Listed in the live tools catalogue by the owner's decision of 19 August 2026, but never
// indexed: this workspace holds invented patients only and must not appear in a search result
// where its synthetic nature is not visible. Use the shared private-app robots object so
// this route does not emit a narrower child override beside the root noindex extras.
export const metadata: Metadata = {
  title: "Caring Contacts - PsychSift",
  robots: PRIVATE_APP_ROBOTS_METADATA,
};

export default function CaringContactsLayout({ children }: { children: ReactNode }) {
  return children;
}
