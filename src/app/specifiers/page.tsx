import { SpecifiersHomePage } from "@/components/specifiers/specifiers-home-page";

type SpecifiersRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[]; run?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SpecifiersRoute({ searchParams }: SpecifiersRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = (firstSearchParam(params.q) ?? firstSearchParam(params.query) ?? "").trim();
  const hasSubmittedSearch = firstSearchParam(params.run) === "1" && query.length > 0;

  return <SpecifiersHomePage query={query} autoRunSearch={hasSubmittedSearch} />;
}
