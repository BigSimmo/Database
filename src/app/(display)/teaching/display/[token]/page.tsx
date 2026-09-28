import type { Metadata } from "next";

import { TeachingDisplayScreen } from "@/components/teaching/teaching-display";

/*
 * The shared screen sits in the `(display)` route group, which has no layout of
 * its own, so only the root layout wraps it: no app chrome, no search shell.
 * The URL is unchanged (route groups do not add a segment).
 */
export const metadata: Metadata = {
  title: "Check-in code | PsychSift",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type TeachingDisplayRouteProps = { params: Promise<{ token: string }> };

export default async function TeachingDisplayRoute({ params }: TeachingDisplayRouteProps) {
  const { token } = await params;
  return <TeachingDisplayScreen secret={token} />;
}
