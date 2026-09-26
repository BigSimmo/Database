import type { Metadata } from "next";

import { AdminNewJobPage } from "@/components/admin/admin-new-job-page";

export const metadata: Metadata = {
  title: "New job | Admin | PsychSift",
  description:
    "Before you start and before you leave: your service's orientation items, logins and access, the contacts for the job, and a download of your own records.",
};

export default function AdminNewJobRoute() {
  return <AdminNewJobPage />;
}
