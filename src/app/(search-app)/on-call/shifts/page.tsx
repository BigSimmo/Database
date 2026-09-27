import { redirect } from "next/navigation";
/** Keep existing bookmarks working after Roster took ownership of shifts. */
export default function OnCallShiftsRedirect() {
  redirect("/roster/shifts");
}
