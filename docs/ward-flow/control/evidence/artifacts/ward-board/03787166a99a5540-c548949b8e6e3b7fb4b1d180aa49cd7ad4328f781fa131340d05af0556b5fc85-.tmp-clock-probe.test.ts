import { describe, it } from "vitest";
import { referrals } from "@/components/ward-management/ward-movements";
import { referralClocks, referralWaitLabel } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("probe", () => {
  it("prints the two clocks", () => {
    const now = NOW_ANCHOR + 240;
    const rows = referrals.map((r) => {
      const c = referralClocks(r, now);
      return `${r.id} triagedAt=${r.triagedAt ?? "-"} current="${referralWaitLabel(r, now)}" sinceRef=${c.sinceReferral} running=${c.sinceReferralRunning} inDept=${c.inDepartment}`;
    });
    console.log("\n" + rows.join("\n"));
  });
});
