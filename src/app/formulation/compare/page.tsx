import { FormulationComparePage } from "@/components/formulation/formulation-compare-page";

type CompareRouteProps = {
  searchParams?: Promise<{ a?: string | string[]; b?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FormulationCompareRoute({ searchParams }: CompareRouteProps) {
  const params = searchParams ? await searchParams : {};
  return <FormulationComparePage initialLeft={firstParam(params.a)} initialRight={firstParam(params.b)} />;
}
