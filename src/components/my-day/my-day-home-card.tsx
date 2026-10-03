"use client";

import { Sunrise } from "lucide-react";

import { useAccountData } from "@/components/account-data-provider";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { MyDayItemRow, useMyDayNow } from "@/components/my-day/my-day-page";
import { useMyDayItems } from "@/components/my-day/use-my-day-items";
import { summariseMyDay } from "@/lib/my-day/merge";

const TOP_COUNT = 3;

/**
 * My Day on the shared home screen. Renders nothing at all (no box, no
 * skeleton) when signed out, loading, in demo mode or with nothing to show, so
 * the home layout never shifts for those readers.
 */
export function MyDayHomeCard({ now: nowProp }: { now?: Date } = {}) {
  const { isAuthenticated } = useAccountData();
  const now = useMyDayNow(nowProp);
  const state = useMyDayItems({ enabled: isAuthenticated, now });

  if (state.status !== "ready" || state.demoMode || state.items.length === 0) return null;

  const summary = summariseMyDay(state.items);
  const parts = [
    summary.overdue > 0 ? `${summary.overdue} overdue` : null,
    summary.soon > 0 ? `${summary.soon} due soon` : null,
  ].filter((part): part is string => part !== null);

  return (
    <ModeGroupedList eyebrow="My Day" headerIcon={Sunrise} mode="my-day" testId="my-day-home-card">
      {state.items.slice(0, TOP_COUNT).map((item) => (
        <MyDayItemRow key={item.id} item={item} now={now} />
      ))}
      <ModeRow
        title={`See all ${summary.total}`}
        subtitle={parts.length > 0 ? parts.join(" · ") : undefined}
        href="/my-day"
        testId="my-day-home-card-see-all"
      />
    </ModeGroupedList>
  );
}
