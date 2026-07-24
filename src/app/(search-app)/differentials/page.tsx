import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";

type DifferentialsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; run?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialsHomeRoute({ searchParams }: DifferentialsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstSearchParam(params.q) ?? firstSearchParam(params.query) ?? "").trim();
  const hasSubmittedSearch = firstSearchParam(params.run) === "1" && query.length > 0;

  if (!hasSubmittedSearch) {
    return <DifferentialsHomePage />;
  }

  return <DifferentialsHomePage query={query} autoRunSearch />;
}
