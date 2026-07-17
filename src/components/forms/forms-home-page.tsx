"use client";

import {
  ArrowLeftRight,
  ClipboardCheck,
  FileQuestion,
  FileText,
  Loader2,
  Route,
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
    description: "Number, pathway, clock, keyword.",
    icon: Search,
    href: appModeHomeHref("forms", { focus: true }),
  },
  {
    title: "Readiness checks",
    description: "Maker, clock, copies, source.",
    icon: ClipboardCheck,
    href: `/forms/${defaultFormSlug() ?? ""}`,
  },
  {
    title: "Browse pathways",
    description: "Before, current, parallel, after.",
    icon: Route,
    href: appModeHomeHref("forms", {
      query: "forms pathway before current parallel after",
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
        body="Your session expired. Sign in again to open private form records and pathways."
        actionHref="/"
        actionLabel="Open account setup"
      />
    ) : registry.status === "error" ? (
      <ModeHomeStatusNotice
        icon={ShieldAlert}
        title="Could not load forms"
        body="The forms registry could not be loaded. Try again shortly."
      />
    ) : !hasRegistryRecords ? (
      <ModeHomeStatusNotice
        icon={FileQuestion}
        title="No forms seeded yet"
        body="Seed your forms registry before opening form detail shortcuts."
      />
    ) : null;

  return (
    <ModeHomeMain testId="forms-home">
      <ModeHomeTemplate
        testId="forms-home-template"
        title="Forms"
        subtitle="The complete WA MHA 2014 forms register. Search by form code, task, authority, clock, or pathway."
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
              label="Governance reviewed"
              body="Official-source MHA 2014 forms"
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
