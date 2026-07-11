import { redirect } from "next/navigation";

type DifferentialPresentationsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; ids?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialPresentationsRoute({ searchParams }: DifferentialPresentationsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.query ?? params.q)?.trim();
  const ids = firstSearchParam(params.ids)?.trim();
  const destinationParams = new URLSearchParams();
  if (query) destinationParams.set("q", query);
  if (ids) destinationParams.set("ids", ids);
  const suffix = destinationParams.size ? `?${destinationParams.toString()}` : "";
  redirect(`/differentials/presentations/acute-confusion-encephalopathy${suffix}`);
}
