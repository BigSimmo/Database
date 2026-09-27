import { useSyncExternalStore } from "react";

import type { AppModeId } from "@/lib/app-modes";
import type { TeachingRole } from "@/lib/teaching/model";

/*
 * The reader's Teaching roles, in memory for this tab only, so the pages sheet
 * can hide Organise from anyone who organises nowhere. A convenience, not a
 * control: the server refuses organiser actions whatever this says. Empty on
 * the server and until a Teaching read lands, so Organise appears only once a
 * role says it should.
 */
const EMPTY: readonly TeachingRole[] = [];
let current: readonly TeachingRole[] = EMPTY;
const listeners = new Set<() => void>();

export function setTeachingRoles(roles: readonly TeachingRole[]): void {
  const next = [...new Set(roles)].sort();
  if (next.join() === current.join()) return;
  current = next.length === 0 ? EMPTY : next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTeachingRoles(): readonly TeachingRole[] {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
}

const ORGANISER_PAGES: ReadonlySet<string> = new Set(["organise"]);

export function modePageVisible(modeId: AppModeId, pageId: string, roles: readonly TeachingRole[]): boolean {
  if (modeId !== "teaching" || !ORGANISER_PAGES.has(pageId)) return true;
  return roles.some((role) => role === "organiser" || role === "admin");
}
