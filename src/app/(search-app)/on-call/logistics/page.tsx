import type { Metadata } from "next";

import { OnCallSectionPage } from "@/components/on-call/on-call-section-page";

export const metadata: Metadata = {
  // "Admin", matching the rail, the heading and the editor. The route segment
  // stays `/on-call/logistics` and the stored section stays `logistics`,
  // because `section` is a database CHECK constraint and renaming it would be
  // a migration for no functional gain — the same label-only split `education`
  // already lives with as "Teaching". This title is the browser tab and the
  // text a shared link carries, so it is the one place where leaving the old
  // word in would actually be read by a person.
  title: "Admin | On Call | PsychSift",
  description:
    "Leave, rosters, pay, forms and access — plus the parking, food and call-room detail worth writing down.",
};

export default function OnCallLogisticsRoute() {
  return <OnCallSectionPage view="logistics" />;
}
