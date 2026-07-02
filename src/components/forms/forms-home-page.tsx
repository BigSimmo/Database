"use client";

import { ArrowLeftRight, ClipboardCheck, FileText, Route, Search, ShieldCheck, Truck, UserRound } from "lucide-react";

import {
  ModeHomeMain,
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
    description: "Search by number, pathway, clock, or keyword.",
    icon: Search,
    href: appModeHomeHref("forms", { focus: true }),
  },
  {
    title: "Readiness checks",
    description: "Review maker, clock, copies, and source.",
    icon: ClipboardCheck,
    href: `/forms/${defaultFormSlug() ?? ""}`,
  },
  {
    title: "Browse pathways",
    description: "Before, current, parallel, and after forms.",
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

  return (
    <ModeHomeMain testId="forms-home">
      <ModeHomeTemplate
        testId="forms-home-template"
        title="What do you need from forms?"
        subtitle="Search, check, or follow a pathway."
        icon={FileText}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Forms tasks"
        actions={taskCards}
        pillsTitle="Common tasks"
        pills={commonTasks}
        footer={
          registry.status === "ready" ? (
            <ModeHomeVerificationFooter
              label="Source verified"
              body="MHA 2014 forms"
              verifiedCount={verifiedCount}
              totalCount={registry.total}
            />
          ) : null
        }
      />
    </ModeHomeMain>
  );
}
