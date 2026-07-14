import type { Metadata } from "next";

import { SpecifierComparePage } from "@/components/specifiers/specifier-compare-page";
import { findSpecifier } from "@/lib/specifiers";

type CompareRouteProps = {
  searchParams?: Promise<{ a?: string | string[]; b?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: CompareRouteProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const left = findSpecifier(first(params.a) ?? "");
  const right = findSpecifier(first(params.b) ?? "");

  if (left && right) {
    return {
      title: `Compare ${left.shortName} and ${right.shortName}`,
      description: `Side-by-side comparison of ${left.name} and ${right.name} specifiers.`,
    };
  }

  return {
    title: "Compare specifiers",
    description: "Compare psychiatric specifiers side by side to understand the deciding features.",
  };
}

export default async function SpecifierCompareRoute({ searchParams }: CompareRouteProps) {
  const params = searchParams ? await searchParams : {};
  return <SpecifierComparePage initialLeft={first(params.a)} initialRight={first(params.b)} />;
}
