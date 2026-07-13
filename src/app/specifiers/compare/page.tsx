import { SpecifierComparePage } from "@/components/specifiers/specifier-compare-page";

type CompareRouteProps = {
  searchParams?: Promise<{ a?: string | string[]; b?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SpecifierCompareRoute({ searchParams }: CompareRouteProps) {
  const params = searchParams ? await searchParams : {};
  return <SpecifierComparePage initialLeft={first(params.a)} initialRight={first(params.b)} />;
}
