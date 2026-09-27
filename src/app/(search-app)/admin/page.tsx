import type { Metadata } from "next";

import { AdminTodayPage } from "@/components/admin/admin-today-page";

export const metadata: Metadata = {
  title: "Today | Admin | PsychSift",
  description:
    "The next renewal to act on, what needs you, how many requirements you have recorded, and your new job's progress.",
};

/** Admin's home (mode id `my-work`). A dashboard, not a redirect stub: the mode has no search surface. */
export default function AdminTodayRoute() {
  return <AdminTodayPage />;
}
