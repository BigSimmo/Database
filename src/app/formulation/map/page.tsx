import dynamic from "next/dynamic";

const FormulationMapPage = dynamic(
  () => import("@/components/formulation/formulation-map-page").then((mod) => mod.FormulationMapPage),
  {
    ssr: false,
    loading: () => <div className="animate-pulse h-screen w-full bg-neutral-100 rounded-lg dark:bg-neutral-800" />,
  }
);

type MapRouteProps = {
  searchParams?: Promise<{ mechanism?: string | string[] }>;
};

export default async function FormulationMapRoute({ searchParams }: MapRouteProps) {
  const params = searchParams ? await searchParams : {};
  const initialId = Array.isArray(params.mechanism) ? params.mechanism[0] : params.mechanism;
  return <FormulationMapPage initialId={initialId} />;
}
