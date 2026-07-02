import { DifferentialsHomePage } from "@/components/differentials/differentials-home-page";

type DifferentialsRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialsHomeRoute({ searchParams }: DifferentialsRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.query ?? params.q)?.trim();

  if (!query) {
    return <DifferentialsHomePage />;
  }

  return <DifferentialsHomePage query={query} />;
}
