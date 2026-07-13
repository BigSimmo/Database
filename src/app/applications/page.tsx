import { redirect } from "next/navigation";

type ApplicationsPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// "Tools" is the canonical name and /tools the canonical route (PT-11); this
// legacy route only forwards old links and browser history.
export default async function ApplicationsRedirect({ searchParams }: ApplicationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.q)?.trim();
  redirect(query ? `/tools?q=${encodeURIComponent(query)}` : "/tools");
}
