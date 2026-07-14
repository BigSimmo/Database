import { redirect } from "next/navigation";

import { findFormulationMechanism } from "@/lib/formulation";

type LegacySpecifierRouteProps = {
  params: Promise<{ path?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
      items.forEach((item) => nextParams.append(key === "specifier" ? "mechanism" : key, item));
    }
  }

  const canPreserveDestination =
    path.length === 1 &&
    (["builder", "compare", "map"].includes(legacyDestination) || Boolean(findFormulationMechanism(legacyDestination)));
  const pathname = canPreserveDestination ? `/formulation/${legacyDestination}` : "/formulation";

  if (path.length && !canPreserveDestination && !nextParams.has("q")) {
    nextParams.set("q", path.join(" ").replaceAll("-", " "));
    nextParams.set("run", "1");
  }

  const suffix = nextParams.toString();
  redirect(suffix ? `${pathname}?${suffix}` : pathname);
}
