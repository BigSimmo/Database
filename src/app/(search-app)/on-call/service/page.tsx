import type { Metadata } from "next";

import { ServicePage } from "@/components/on-call/service-page";

export const metadata: Metadata = {
  title: "Service handbook | On Call | PsychSift",
  description: "Service-maintained on-call orientation, contacts, referrals and practical resources.",
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function OnCallServiceRoute({
  searchParams,
}: {
  readonly searchParams: Promise<{
    service?: string | string[];
    site?: string | string[];
    rotation?: string | string[];
  }>;
}) {
  const query = await searchParams;
  return (
    <ServicePage
      initialServiceId={first(query.service)}
      initialSiteId={first(query.site)}
      initialRotation={first(query.rotation) ?? ""}
    />
  );
}
