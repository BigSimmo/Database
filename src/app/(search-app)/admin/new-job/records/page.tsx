import type { Metadata } from "next";

import { AdminRecordsPage } from "@/components/admin/new-job/admin-records-page";

export const metadata: Metadata = {
  title: "Your Admin records | Admin | PsychSift",
  description:
    "Your own renewals, admin entries and contacts, exactly as you recorded them — read on screen, never a download.",
};

export default function AdminRecordsRoute() {
  return <AdminRecordsPage />;
}
