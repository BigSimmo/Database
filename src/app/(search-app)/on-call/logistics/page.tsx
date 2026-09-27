import { redirect } from "next/navigation";

/** Backstop: moved to Admin > Help (Admin update 1). The proxy's 307 normally answers first. */
export default function OnCallLogisticsBackstop() {
  redirect("/admin/help");
}
