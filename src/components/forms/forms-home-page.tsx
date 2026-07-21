"use client";

import {
  ArrowLeftRight,
  ClipboardCheck,
  FileQuestion,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";

import {
  ModeHomeMain,
  ModeHomeStatusNotice,
  ModeHomeTemplate,
  ModeHomeVerificationFooter,
  type ModeHomeAction,
  type ModeHomePill,
} from "@/components/mode-home-template";
import { appModeHomeHref } from "@/lib/app-modes";
import { defaultFormSlug } from "@/lib/forms";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { countVerifiedRegistryRecords, useRegistryRecords } from "@/lib/use-registry-records";

const taskCards: ModeHomeAction[] = [
  {
    title: "Find a form",
    description: "Title, purpose, or workflow detail.",
    icon: Search,
    href: appModeHomeHref("forms", { focus: true }),
  },
  {
    title: "Readiness checks",
    description: "Review status, source, and local confirmation.",
    icon: ClipboardCheck,
    href: `/forms/${defaultFormSlug() ?? ""}`,
  },
  {
    title: "Check source status",
    description: "Find records that still need local confirmation.",
    icon: ShieldAlert,
    href: appModeHomeHref("forms", {
      query: "local confirmation required",
      focus: true,
      run: true,
    }),
  },
];

const commonTasks: ModeHomePill[] = [
  {
    label: "Transport",
    icon: Truck,
    href: appModeHomeHref("forms", { query: "transport forms", focus: true, run: true }),
  },
  {
    label: "Assessment",
    icon: UserRound,
    href: appModeHomeHref("forms", { query: "assessment forms", focus: true, run: true }),
  },
  {
    label: "Transfer",
    icon: ArrowLeftRight,
    href: appModeHomeHref("forms", { query: "transfer forms", focus: true, run: true }),
  },
  {
    label: "Treatment",
    icon: ShieldCheck,
    href: appModeHomeHref("forms", { query: "treatment forms", focus: true, run: true }),
  },
];

export function FormsHomePage() {
  const registry = useRegistryRecords("form");
  const verifiedCount = countVerifiedRegistryRecords(registry);
  const registryReady = registry.status === "ready";
  const hasRegistryRecords = registryReady && registry.total > 0;
  const registryNotice =
    registry.status === "loading" ? (
      <ModeHomeStatusNotice
        icon={Loader2}
        title="Loading forms registry"
        body="Form tasks will appear once your private registry is ready."
      />
    ) : registry.status === "unauthorized" ? (
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Session expired"
        body="Your session expired. Use the account control in the header to sign in again."
      />
    ) : registry.status === "error" ? (
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Could not load forms"
        body="The forms registry could not be loaded."
        actionLabel="Try again"
        onAction={registry.refetch}
      />
    ) : !hasRegistryRecords ? (
      <ModeHomeStatusNotice
        icon={FileQuestion}
        title="No forms seeded yet"
        body="Seed your forms registry before opening form detail shortcuts."
      />
    ) : null;

  return (
    <ModeHomeMain
      testId="forms-home"
      // Seeded homes are content-rich and can clip when centered on phone;
      // loading/empty notices stay short — keep those vertically centred.
      contentAlign={hasRegistryRecords ? "startOnPhone" : "center"}
    >
      <ModeHomeTemplate
        testId="forms-home-template"
        title="Forms"
        subtitle="The WA MHA 2014 forms register."
        icon={FileText}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Forms tasks"
        actions={hasRegistryRecords ? taskCards : []}
        pillsTitle="Browse by type"
        pills={hasRegistryRecords ? commonTasks : []}
        footer={
          hasRegistryRecords ? (
            <ModeHomeVerificationFooter
              icon={ShieldCheck}
              label="Source catalogue reviewed"
              body="Official-source MHA 2014 forms · verify before use"
              verifiedCount={verifiedCount}
              totalCount={registry.total}
            />
          ) : (
            registryNotice
          )
        }
      />
    </ModeHomeMain>
  );
}
