import { DifferentialStreamPage } from "@/components/differentials/differential-stream-page";

type DifferentialDiagnosesRouteProps = {
  searchParams?: Promise<{ query?: string | string[]; q?: string | string[] }>;
};

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DifferentialDiagnosesRoute({ searchParams }: DifferentialDiagnosesRouteProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstSearchParam(params.query ?? params.q)?.trim() ?? "";

  return <DifferentialStreamPage stream="diagnoses" query={query} />;
}
