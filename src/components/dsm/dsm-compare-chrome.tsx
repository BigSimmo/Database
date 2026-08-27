"use client";

import { BookOpenCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  CompareIdsChrome,
  idsCompareHref,
  type CompareCatalogItem,
  type CompareStarterChip,
} from "@/components/compare";

export function DsmCompareChrome({
  selectedIds,
  items,
  starters,
}: {
  selectedIds: readonly (string | null | undefined)[];
  items: readonly CompareCatalogItem[];
  starters: readonly CompareStarterChip[];
}) {
  const router = useRouter();
  return (
    <CompareIdsChrome
      selectedIds={selectedIds}
      maxCount={3}
      items={items}
      starters={starters}
      emptyTitle="Choose at least two diagnoses"
      emptyDescription="Search the DSM catalogue, or start from a common trio."
      actionLabel="Choose diagnoses"
      searchPlaceholder="Search diagnosis or ICD code"
      pickerTitle="Choose diagnoses"
      pickerDescription="Assign up to three diagnoses. Duplicates are blocked."
      pickerId="dsm-compare-picker"
      pickerTestId="dsm-compare-picker"
      changeLabel="Change diagnoses"
      slotPlaceholder="Choose diagnosis"
      icon={BookOpenCheck}
      onCommit={(ids) =>
        router.push(
          idsCompareHref(
            "/dsm/compare",
            ids.filter((id): id is string => Boolean(id)),
          ),
        )
      }
    />
  );
}
