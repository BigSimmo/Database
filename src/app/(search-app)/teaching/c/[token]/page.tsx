import type { Metadata } from "next";

import { TeachingScanLanding } from "@/components/teaching/teaching-scan-landing";

// The token must never leave in a Referer header or reach a search index (part 2 S4 Step 14).
export const metadata: Metadata = {
  title: "Check in | Teaching | PsychSift",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type TeachingScanRouteProps = { params: Promise<{ token: string }> };

export default async function TeachingScanRoute({ params }: TeachingScanRouteProps) {
  const { token } = await params;
  return <TeachingScanLanding token={token} />;
}
