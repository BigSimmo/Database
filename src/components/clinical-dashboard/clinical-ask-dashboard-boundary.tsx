"use client";

import type { ReactNode } from "react";
import { ClinicalAskSessionProvider } from "@/components/clinical-dashboard/clinical-ask-session-context";
import { useAuthSession } from "@/lib/supabase/client";

export function ClinicalAskDashboardBoundary({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  return <ClinicalAskSessionProvider accountId={auth.session?.user.id}>{children}</ClinicalAskSessionProvider>;
}
