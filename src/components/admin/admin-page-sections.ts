import { BookOpen, ClipboardList, LifeBuoy, LogOut, MapPinned, Phone } from "lucide-react";

import type { PageSection } from "@/components/in-page-nav/page-section-index";

export const ADMIN_PAGE_HREFS = {
  today: "/admin",
  renewals: "/admin/renewals",
  newJob: "/admin/new-job",
  help: "/admin/help",
} as const;

/** One word per tab (spec), drawn by the `wordmark-five` rail. The ids are the DOM anchors. */
export const ADMIN_NEW_JOB_SECTIONS: readonly PageSection[] = [
  { id: "admin-new-job-before", label: "Before", icon: ClipboardList },
  { id: "admin-new-job-leaving", label: "Leaving", icon: LogOut },
];

export const ADMIN_HELP_SECTIONS: readonly PageSection[] = [
  { id: "admin-help-support", label: "Support", icon: LifeBuoy },
  { id: "admin-help-guides", label: "Guides", icon: BookOpen },
  { id: "admin-help-contacts", label: "Contacts", icon: Phone },
  { id: "admin-help-on-site", label: "On site", icon: MapPinned },
];

export const ADMIN_HELP_ON_SITE_HREF = `${ADMIN_PAGE_HREFS.help}#admin-help-on-site`;
