import type { Metadata } from "next";

import { AdminTodayPage } from "@/components/admin/admin-today-page";

export const metadata: Metadata = {
  title: "Today | Admin | PsychSift",
  description: "Renewals to start now, what is coming up in the next 90 days, and what is next.",
};

/** Admin's home (mode id `my-work`). A dashboard, not a redirect stub: the mode has no search surface. */
export default function AdminTodayRoute() {
  return <AdminTodayPage />;
}
