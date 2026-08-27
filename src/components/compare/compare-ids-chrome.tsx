"use client";

import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { CompareCatalogPicker } from "@/components/compare/compare-catalog-picker";
import { CompareEmptyState } from "@/components/compare/compare-empty-state";
import { ComparePickerShell } from "@/components/compare/compare-picker-shell";
import { CompareSlotStrip } from "@/components/compare/compare-slot-strip";
import { assignCompareId, firstEmptySlot, padCompareIds, slotLetters } from "@/components/compare/filter-catalog";
import type {
  CompareCatalogItem,
  ComparePhoneLayout,
  CompareSlot,
  CompareStarterChip,
} from "@/components/compare/types";
import { useComparePicker } from "@/components/compare/use-compare-picker";
import { usePhoneMedia } from "@/components/compare/use-phone-media";

export function CompareIdsChrome({
  selectedIds,
  maxCount,
  minCount = 2,
  items,
  starters,
  emptyTitle,
  emptyDescription,
  actionLabel,
  searchPlaceholder,
  pickerTitle,
  pickerDescription,
  pickerId,
  pickerTestId,
  changeLabel = "Change selection",
  slotPlaceholder = "Choose",
  swapLabel,
  icon,
  filterLocally = true,
  phoneLayout = "default",
  slotSummaryLabel,
  onCommit,
}: {
  selectedIds: readonly (string | null | undefined)[];
  maxCount: number;
  minCount?: number;
  items: readonly CompareCatalogItem[];
  starters?: readonly CompareStarterChip[];
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
  searchPlaceholder: string;
  pickerTitle: string;
  pickerDescription: string;
  pickerId: string;
  pickerTestId: string;
  changeLabel?: string;
  slotPlaceholder?: string;
  swapLabel?: string;
  icon?: LucideIcon;
  filterLocally?: boolean;
  phoneLayout?: ComparePhoneLayout;
  slotSummaryLabel?: string;
  onCommit: (ids: Array<string | null>) => void;
}) {
  const phone = usePhoneMedia();
  const ids = padCompareIds(selectedIds, maxCount);
  const filled = ids.filter(Boolean).length;
  const picker = useComparePicker(filled < minCount, firstEmptySlot(ids) ?? 0);
  const [announcement, setAnnouncement] = useState("");
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const labels = slotLetters(maxCount);
  const slots: CompareSlot[] = ids.map((id, index) => {
    const item = id ? byId.get(id) : undefined;
    return {
      id,
      label: labels[index] ?? String(index + 1),
      title: item?.title ?? slotPlaceholder,
      subtitle: item?.snippet ?? item?.tag,
    };
  });
  const suppressEmptyState = phoneLayout === "hybrid" && phone && filled < minCount;

  function commit(next: Array<string | null>, chosenId?: string) {
    if (chosenId) {
      const item = byId.get(chosenId);
      const label = labels[picker.activeSlot] ?? "slot";
      setAnnouncement(item ? `${item.title} added as ${label}` : `${chosenId} added as ${label}`);
    }
    const empty = firstEmptySlot(next);
    if (empty === null) picker.close();
    else picker.setActiveSlot(empty);
    onCommit(next);
  }

  function choose(id: string) {
    commit(assignCompareId(ids, picker.activeSlot, id), id);
  }

  function swap() {
    if (maxCount !== 2 || !ids[0] || !ids[1]) return;
    onCommit([ids[1], ids[0]]);
  }

  function openPicker() {
    picker.openSlot(firstEmptySlot(ids) ?? 0);
  }

  return (
    <>
      <CompareSlotStrip
        slots={slots}
        activeIndex={picker.open ? picker.activeSlot : null}
        onSelectSlot={picker.openSlot}
        onClearSlot={(index) => commit(ids.map((id, slotIndex) => (slotIndex === index ? null : id)))}
        onSwap={maxCount === 2 ? swap : undefined}
        swapLabel={swapLabel}
        changeLabel={changeLabel}
        onChange={openPicker}
        phoneLayout={phoneLayout}
        actionLabel={actionLabel}
        minCount={minCount}
        slotSummaryLabel={slotSummaryLabel}
        starters={starters}
        onPrimaryAction={openPicker}
      />
      <ComparePickerShell
        open={picker.open}
        onClose={picker.close}
        title={pickerTitle}
        description={pickerDescription}
        phone={picker.phone}
        id={pickerId}
        testId={pickerTestId}
      >
        <CompareCatalogPicker
          items={items}
          query={picker.query}
          onQueryChange={picker.setQuery}
          selectedIds={ids}
          maxCount={maxCount}
          activeSlot={picker.activeSlot}
          onActiveSlotChange={picker.setActiveSlot}
          onChoose={choose}
          onDone={picker.close}
          onReset={() => commit(padCompareIds([], maxCount))}
          searchPlaceholder={searchPlaceholder}
          emptyHint="No matching items."
          announcement={announcement}
          filterLocally={filterLocally}
          title={pickerTitle}
          titleId={`${pickerId}-title`}
          starters={starters}
        />
      </ComparePickerShell>
      {filled < minCount && !suppressEmptyState ? (
        <CompareEmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={actionLabel}
          onAction={openPicker}
          chips={starters}
        />
      ) : null}
    </>
  );
}
