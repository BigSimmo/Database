import { type NextRequest } from "next/server";

// Legacy prescribing home. Preserve the search context the same way the root
// legacy-mode redirect does (q plus the focus/run flags, sanitized) so a
// bookmarked /medications?q=lithium link keeps its query after the redirect.
export function GET(request: NextRequest) {
  const params = new URLSearchParams({ mode: "prescribing" });
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (query) params.set("q", query);
  if (request.nextUrl.searchParams.get("focus") === "1") params.set("focus", "1");
  if (request.nextUrl.searchParams.get("run") === "1") params.set("run", "1");
  return new Response(null, {
    status: 307,
    headers: { Location: `/?${params.toString()}` },
  });
}

export const HEAD = GET;
