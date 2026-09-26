import type { Metadata } from "next";

import { AdminRenewalsPage } from "@/components/admin/admin-renewals-page";

export const metadata: Metadata = {
  title: "Renewals | Admin | PsychSift",
  // The same two halves the On Call page's description carried: what it is, and what it is not.
  description:
    "The requirements you keep current — registration, indemnity, credentialing, training — grouped by what happens if they lapse. Your own recorded dates, never a check with the issuing body.",
};

export default function AdminRenewalsRoute() {
  return <AdminRenewalsPage />;
}
