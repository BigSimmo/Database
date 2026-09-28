import type { Metadata } from "next";

import { TeachingScanLanding } from "@/components/teaching/teaching-scan-landing";

export const metadata: Metadata = {
  title: "Check in | Teaching | PsychSift",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Where the sign-in email returns a doctor who scanned while signed out. A static segment wins over `[token]`. */
export default function TeachingScanCompleteRoute() {
  return <TeachingScanLanding token={null} />;
}
