import { DifferentialStreamWorkspace } from "@/components/differentials/differential-stream-workspace";
import { buildDifferentialStreamModel } from "@/lib/differential-stream";
import type { DifferentialStreamType } from "@/lib/differential-stream-model";

type DifferentialStreamPageProps = {
  query?: string;
  focus?: string;
  stream: DifferentialStreamType;
};

export function DifferentialStreamPage({ stream, query = "", focus = "" }: DifferentialStreamPageProps) {
  const model = buildDifferentialStreamModel(stream, query);
  return <DifferentialStreamWorkspace model={model} query={query} initialFocus={focus} />;
}
