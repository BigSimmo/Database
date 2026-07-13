"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { readResultSort, resultSortHref, type ResultSortValue } from "@/lib/result-sort";

export function useResultSort() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = readResultSort(searchParams.get("sort"));

  const setSort = useCallback(
    (nextSort: ResultSortValue) => {
      router.push(resultSortHref(pathname, searchParams, nextSort), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [sort, setSort] as const;
}
