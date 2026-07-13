import { redirect } from "next/navigation";

type ApplicationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function forwardedSearchParams(params: Record<string, string | string[] | undefined>) {
  const forwarded = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) forwarded.append(key, item);
    }
  }
  return forwarded.toString();
}

// "Tools" is the canonical name and /tools the canonical route (PT-11); this
// legacy route only forwards old links and browser history.
export default async function ApplicationsRedirect({ searchParams }: ApplicationsPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = forwardedSearchParams(params);
  redirect(query ? `/tools?${query}` : "/tools");
}
