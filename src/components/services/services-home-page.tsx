"use client";

import { FileQuestion, Loader2, ShieldAlert, Users } from "lucide-react";

import {
  ModeHomeMain,
  ModeHomeStatusNotice,
  ModeHomeTemplate,
  ModeHomeVerificationFooter,
} from "@/components/mode-home-template";
import { ServiceGroupNav } from "@/components/services/service-group-nav";
import { ServiceReferralFlow } from "@/components/services/service-referral-flow";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { serviceCoreGroups, serviceMatchesCoreGroup, type ServiceCoreGroupId } from "@/lib/service-core-groups";
import { countVerifiedRegistryRecords, useRegistryRecords } from "@/lib/use-registry-records";

function groupHref(group: ServiceCoreGroupId | null) {
  const params = new URLSearchParams({ run: "1" });
  if (group) params.set("group", group);
  return `/services?${params.toString()}`;
}

export function ServicesHomePage() {
  const registry = useRegistryRecords("service");
  const verifiedCount = countVerifiedRegistryRecords(registry);
  const registryReady = registry.status === "ready" || registry.status === "refetching";
  const hasRegistryRecords = registryReady && registry.total > 0;
  const groupCounts = Object.fromEntries(
    serviceCoreGroups.map((group) => [
      group.id,
      registry.records.filter((service) => serviceMatchesCoreGroup(service, group.id)).length,
    ]),
  ) as Record<ServiceCoreGroupId, number>;
  const registryNotice =
    registry.status === "loading" ? (
      <ModeHomeStatusNotice
        icon={Loader2}
        title="Loading services registry"
        body="Service tasks will appear once your private registry is ready."
      />
    ) : registry.status === "unauthorized" ? (
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Session expired"
        body="Your session expired. Sign in again to open private service records and referral pathways."
        actionHref="/"
        actionLabel="Open account setup"
      />
    ) : registry.status === "error" ? (
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Could not load services"
        body="The services registry could not be loaded."
        actionLabel="Try again"
        onAction={registry.refetch}
      />
    ) : !hasRegistryRecords ? (
      <ModeHomeStatusNotice
        icon={FileQuestion}
        title="No services seeded yet"
        body="Seed your services registry before opening service detail shortcuts."
      />
    ) : null;

  return (
    <ModeHomeMain
      testId="services-home"
      // Keep loading on startOnPhone so the seeded registry does not jump from
      // center → top when records arrive. Confirmed empty/error notices stay centred.
      contentAlign={registry.status === "loading" || hasRegistryRecords ? "startOnPhone" : "center"}
    >
      <div className="mx-auto grid w-full max-w-[60rem] gap-4 lg:gap-5">
        <ModeHomeTemplate
          testId="services-home-template"
          title="Services"
          subtitle="Find the right service, check fit, compare options, and refer with confidence."
          icon={Users}
          desktopComposerSlotId={modeHomeDesktopComposerSlotId}
          actionsLabel="Referral workflow"
          actions={[]}
        />
        {hasRegistryRecords ? (
          <>
            <ServiceReferralFlow active="search" variant="cards" className="px-4 sm:px-0" />
            <section className="grid gap-2.5 border-t border-[color:var(--border)]/70 px-4 pt-4 sm:px-0">
              <div className="flex items-end justify-between gap-3">
                <div className="text-left">
                  <h2 className="text-sm font-bold text-[color:var(--text-heading)]">Browse core groups</h2>
                  <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                    Start broad, then refine by need, catchment, eligibility, and route.
                  </p>
                </div>
                <span className="nums shrink-0 text-xs font-semibold text-[color:var(--text-muted)]">
                  {registry.total} services
                </span>
              </div>
              <ServiceGroupNav
                activeGroup={null}
                hrefForGroup={groupHref}
                counts={{ ...groupCounts, all: registry.total }}
              />
            </section>
            <div className="px-4 sm:px-0">
              <ModeHomeVerificationFooter
                label="Referral fit"
                body="Confirm eligibility, availability and contact details locally"
                verifiedCount={verifiedCount}
                totalCount={registry.total}
              />
            </div>
          </>
        ) : (
          <div className="px-4 sm:px-0">{registryNotice}</div>
        )}
      </div>
    </ModeHomeMain>
  );
}
