import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { documentSourceRedirectTarget } from "@/lib/document-source-redirect";

export const metadata: Metadata = { title: "Document Source - PsychSift" };

// Backstop only: src/proxy.ts resolves these fallbacks as a plain HTTP 307
// before rendering (issue #024 — the streamed server-redirect path raised
// WebKit `_rsc` access-control pageerrors). This page keeps the route valid
// and correct for any request the proxy matcher misses.
export default async function DocumentsSourceRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const entries = Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  redirect(documentSourceRedirectTarget(new URLSearchParams(entries)));
}
