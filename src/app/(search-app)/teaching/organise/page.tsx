import type { Metadata } from "next";

import { TeachingOrganise } from "@/components/teaching/teaching-organise";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Organise | Teaching | PsychSift",
  description: "Your service's teaching programme: series, groups, members and changes.",
  robots: { index: false, follow: false },
};

/* Demo mode is read on the server. The server refuses anyone who is not an organiser or admin. */
export default function TeachingOrganiseRoute() {
  return <TeachingOrganise demoMode={isDemoMode()} />;
}
