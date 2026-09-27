import { redirect } from "next/navigation";

/** Backstop: moved to Admin > Renewals (Admin update 1). The proxy's 307 normally answers first. */
export default function OnCallComplianceBackstop() {
  redirect("/admin/renewals");
}
