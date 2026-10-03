"use client";

import { useMemo } from "react";

import { AdminPinnedNumbers } from "@/components/admin/admin-pinned-numbers";
import { buildAdminHelpItems } from "@/lib/admin/help-items";
import { adminLoadState, selectAdminOwnEntries, selectAdminSharedEntries } from "@/lib/admin/own-entries";
import { useOnCallEntries } from "@/lib/on-call/entry-store";

/**
 * The numbers the reader pinned in Admin Help, built exactly as Admin Today
 * builds them. `AdminPinnedNumbers` draws nothing until something is pinned;
 * this draws nothing at all unless the entries loaded.
 */
export function MyDayPinnedNumbers() {
  const state = useOnCallEntries();
  const own = useMemo(() => selectAdminOwnEntries(state), [state]);
  const shared = useMemo(() => selectAdminSharedEntries(state), [state]);
  const items = useMemo(() => buildAdminHelpItems({ own, shared, statewide: [] }), [own, shared]);
  if (adminLoadState(state) !== "ready") return null;
  return <AdminPinnedNumbers items={items} testId="my-day-module-pinned" />;
}
