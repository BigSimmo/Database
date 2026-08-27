import type { Metadata } from "next";

import { ReviewStatePageContent } from "@/components/developer-area/hub/review-state-page-content";

export const metadata: Metadata = {
  title: "Review state · Developer · Clinical KB",
  description: "Every immutable review record: which ref was reviewed, at which head, with what outcome.",
};

type DeveloperReviewStatePageProps = {
  searchParams?: Promise<{ page?: string | string[] }>;
};

function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

/**
 * Thin async wrapper only — Next 16 serves `searchParams` as a `Promise`, so
 * unwrapping it is the one thing here that has to be async. Everything else
 * (the snapshot read, the pagination slice, the actual markup) stays in the
 * synchronous `ReviewStatePageContent`, which is what `render()` can execute
 * directly the same way every sibling developer-hub page's dom test does —
 * mirrors `ToolsRoute` in `src/app/(search-app)/tools/page.tsx`.
 */
export default async function DeveloperReviewStatePage({ searchParams }: DeveloperReviewStatePageProps) {
  const params = searchParams ? await searchParams : {};
  return <ReviewStatePageContent requestedPage={parsePageParam(params.page)} />;
}
