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
  const names = [left?.shortName, right?.shortName].filter(Boolean);

  return {
    title: `${names.length ? `Compare ${names.join(" and ")}` : "Compare psychiatric specifiers"} - Clinical KB`,
    description:
      left && right
        ? `Compare ${left.name} and ${right.name} side by side, including clinical signals, timing, and cautions.`
        : "Compare psychiatric specifiers side by side, including clinical signals, timing, and cautions.",
  };
}

export default async function SpecifierCompareRoute({ searchParams }: CompareRouteProps) {
  const params = searchParams ? await searchParams : {};
  return <SpecifierComparePage initialLeft={first(params.a)} initialRight={first(params.b)} />;
}
