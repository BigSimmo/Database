import { redirect } from "next/navigation";

type DifferentialPresentationsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialPresentationsRoute({ searchParams }: DifferentialPresentationsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.query ?? params.q)?.trim();
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  redirect(`/differentials/presentations/acute-confusion-encephalopathy${suffix}`);
}
