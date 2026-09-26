import { isAdminWorkforceExplainer } from "@/lib/admin/placement";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { partitionLogisticsEntries } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

export type LeavingPackRecord = Omit<OnCallEntry, "isOwn">;
export type LeavingPack = {
  version: 1;
  exportedAt: string;
  note: string;
  renewals: LeavingPackRecord[];
  adminEntries: LeavingPackRecord[];
  contacts: LeavingPackRecord[];
};

const strip = ({ isOwn: _isOwn, ...record }: OnCallEntry): LeavingPackRecord => record;

/**
 * Spec: "Doctors can download all their own Admin records." Shared rows are other
 * doctors' records and never go in. Update 2 adds service ticks, pay and leave here.
 */
export function buildLeavingPack(input: { ownEntries: readonly OnCallEntry[]; now: Date }): LeavingPack {
  const { admin, compliance } = partitionLogisticsEntries(input.ownEntries);
  return {
    version: 1,
    exportedAt: input.now.toISOString(),
    note: "Your own Admin records as you entered them. Nothing here was checked with an issuer.",
    renewals: compliance.map(strip),
    adminEntries: admin.map(strip),
    contacts: input.ownEntries.filter(isAdminWorkforceExplainer).map(strip),
  };
}

export function leavingPackFileName(now: Date): string {
  return `admin-leaving-pack-${perthCalendarDate(now)}.json`;
}
