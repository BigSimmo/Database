import { FormulationMapPage } from "@/components/formulation/formulation-map-page";

type MapRouteProps = {
  searchParams?: Promise<{ mechanism?: string | string[] }>;
};

export default async function FormulationMapRoute({ searchParams }: MapRouteProps) {
  const params = searchParams ? await searchParams : {};
  const initialId = Array.isArray(params.mechanism) ? params.mechanism[0] : params.mechanism;
  return <FormulationMapPage initialId={initialId} />;
}
