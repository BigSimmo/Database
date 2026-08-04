import { FormulationHomePage } from "@/components/formulation/formulation-home-page";

type FormulationRouteProps = {
  searchParams?: Promise<{ q?: string | string[]; run?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FormulationRoute({ searchParams }: FormulationRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q)?.trim() ?? "";
  const hasSubmittedSearch = firstParam(params.run) === "1" && query.length > 0;
  return <FormulationHomePage query={query} autoRunSearch={hasSubmittedSearch} />;
}
