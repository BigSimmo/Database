import { redirect } from "next/navigation";
/** Keep existing bookmarks working after Roster took ownership of calendars. */
export default function OnCallCalendarRedirect() {
  redirect("/roster/calendar");
}
