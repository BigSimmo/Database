import { redirect } from "next/navigation";

import { findFormulationMechanism } from "@/lib/formulation";

type LegacySpecifierRouteProps = {
  params: Promise<{ path?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function humanizeLegacyMechanism(value: string) {
  return value.replaceAll("-", " ").trim();
}

export default async function LegacySpecifierRoute({ params, searchParams }: LegacySpecifierRouteProps) {
  const { path = [] } = await params;
  const values = searchParams ? await searchParams : {};
  const [legacyDestination] = path;
  const isLegacyCompare = path.length === 1 && legacyDestination === "compare";
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    if (key === "specifier" && isLegacyCompare) {
      items.slice(0, 2).forEach((item, index) => nextParams.append(index === 0 ? "a" : "b", item));
    } else {
      const destinationKey = key === "specifier" ? "mechanism" : key === "query" ? "q" : key;
      items.forEach((item) => nextParams.append(destinationKey, item));
    }
  }

  let canPreserveDestination =
    path.length === 1 &&
    (["builder", "compare", "map"].includes(legacyDestination) || Boolean(findFormulationMechanism(legacyDestination)));

  const mechanismParamKeys =
    legacyDestination === "compare"
      ? ["a", "b"]
      : legacyDestination === "builder" || legacyDestination === "map"
        ? ["mechanism"]
        : [];
  const requestedMechanisms = mechanismParamKeys.flatMap((key) => nextParams.getAll(key));
  const hasUnsupportedMechanism = requestedMechanisms.some((id) => !findFormulationMechanism(id));

  if (hasUnsupportedMechanism) {
    canPreserveDestination = false;
    mechanismParamKeys.forEach((key) => nextParams.delete(key));
    if (!nextParams.has("q")) {
      nextParams.set("q", requestedMechanisms.map(humanizeLegacyMechanism).join(" versus "));
    }
    nextParams.set("run", "1");
  }

  if (!path.length && nextParams.has("mechanism")) {
    const requested = nextParams.getAll("mechanism");
    nextParams.delete("mechanism");
    if (!nextParams.has("q")) nextParams.set("q", requested.map(humanizeLegacyMechanism).join(" "));
    nextParams.set("run", "1");
  }

  const pathname = canPreserveDestination ? `/formulation/${legacyDestination}` : "/formulation";

  if (path.length && !canPreserveDestination && !nextParams.has("q")) {
    nextParams.set("q", humanizeLegacyMechanism(path.join(" ")));
    nextParams.set("run", "1");
  }

  const suffix = nextParams.toString();
  redirect(suffix ? `${pathname}?${suffix}` : pathname);
}
