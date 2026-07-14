import { redirect } from "next/navigation";

type LegacySpecifierRouteProps = {
  params: Promise<{ path?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacySpecifierRoute({ params, searchParams }: LegacySpecifierRouteProps) {
  const { path = [] } = await params;
  const values = searchParams ? await searchParams : {};
  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => nextParams.append(key === "specifier" ? "mechanism" : key, item));
    else if (value) nextParams.set(key === "specifier" ? "mechanism" : key, value);
  }
  const pathname = ["/formulation", ...path].join("/");
  const suffix = nextParams.toString();
  redirect(suffix ? `${pathname}?${suffix}` : pathname);
}
