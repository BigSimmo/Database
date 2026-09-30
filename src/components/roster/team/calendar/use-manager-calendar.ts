"use client";

import { useMemo } from "react";

import { useRosterRead } from "@/components/roster/use-roster-team";
import { addDaysToDate } from "@/lib/roster/shifts/perth-time";
import { coverForDay, type CoverCount } from "@/lib/roster/team/cover";
import type {
  RosterAssignment,
  RosterManageOpenShift,
  RosterManageSwap,
  RosterRules,
  RosterTeam,
} from "@/lib/roster/team/model";
import { ruleFlags, type RuleFlag } from "@/lib/roster/team/rule-flags";

export type ManagerCalendar = {
  enabled: boolean;
  cover: Map<string, CoverCount[]>;
  flags: Map<string, RuleFlag[]>;
  pending: RosterManageSwap[];
  claimed: RosterManageOpenShift[];
  shortDays: string[];
  /** Read the manager's swaps and open shifts again after a decision. */
  reload: () => void;
};

const NO_RULES: RosterRules = {};

/**
 * The manager layer of the team calendar: cover counts against the team's
 * targets, rule flags, and what is waiting on the manager's decision.
 *
 * Pass every assignment read for the window, not the filtered ones, or a
 * "Just me" view would show every day as short. A member makes no manager
 * reads at all. It is `enabled` only while both the `manage` and `maker` reads
 * have answered, so a failed read leaves the staff calendar as it was.
 */
export function useManagerCalendar(
  team: RosterTeam,
  window: { from: string; to: string },
  rows: RosterAssignment[],
): ManagerCalendar {
  const isManager = team.role === "manager";
  const serviceId = isManager ? team.serviceId : null;
  const manage = useRosterRead(serviceId, "manage");
  const maker = useRosterRead(serviceId, "maker");
  const overview = useRosterRead(serviceId, "overview");
  const enabled = isManager && manage.status === "ready" && maker.status === "ready";
  const needs = maker.data?.needs;
  const rules = overview.data?.settings.rules ?? NO_RULES;
  const { from, to } = window;

  const cover = useMemo(() => {
    const counts = new Map<string, CoverCount[]>();
    if (!enabled || !needs?.length) return counts;
    for (let date = from; date <= to; date = addDaysToDate(date, 1)) {
      const forDay = coverForDay(date, rows, needs);
      if (forDay.length) counts.set(date, forDay);
    }
    return counts;
  }, [enabled, needs, rows, from, to]);

  const flags = useMemo(() => {
    const byShift = new Map<string, RuleFlag[]>();
    if (!enabled) return byShift;
    for (const flag of ruleFlags(rows, rules)) {
      const list = byShift.get(flag.assignmentId);
      if (list) list.push(flag);
      else byShift.set(flag.assignmentId, [flag]);
    }
    return byShift;
  }, [enabled, rows, rules]);

  const shortDays = useMemo(
    () =>
      [...cover.entries()]
        .filter(([, counts]) => counts.some((count) => count.state === "short"))
        .map(([date]) => date),
    [cover],
  );

  const swaps = manage.data?.swaps;
  const openShifts = manage.data?.openShifts;
  const pending = useMemo(
    () => (enabled ? (swaps ?? []).filter((swap) => swap.status === "accepted") : []),
    [enabled, swaps],
  );
  const claimed = useMemo(
    () => (enabled ? (openShifts ?? []).filter((shift) => shift.status === "claimed") : []),
    [enabled, openShifts],
  );

  return { enabled, cover, flags, pending, claimed, shortDays, reload: manage.reload };
}
