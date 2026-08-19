"use client";

import {
  ArrowLeftRight,
  ClipboardCheck,
  FileQuestion,
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
  type ModeHomeAction,
  type ModeHomePill,
} from "@/components/mode-home-template";
import { appModeIcons } from "@/lib/app-mode-icons";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { sharedHomePresentation } from "@/lib/ui-copy";
import { useRegistryRecords } from "@/lib/use-registry-records";

// The default form slug is computed server-side (app/forms/page.tsx) and passed
// as a prop: a direct `@/lib/forms` value import here would compile the full
// forms catalog into this client route chunk.
function buildTaskCards(defaultFormSlug: string | null): ModeHomeAction[] {
  const cards: ModeHomeAction[] = [
    {
      title: "Find a form",
      description: "Title, purpose, or workflow detail.",
      icon: Search,
      href: appModeHomeHref("forms", { focus: true }),
    },
  ];
  if (defaultFormSlug) {
    cards.push({
      title: "Readiness checks",
      description: "Review status, source, and local confirmation.",
      icon: ClipboardCheck,
      href: `/forms/${defaultFormSlug}`,
    });
  }
  cards.push({
    title: "Check source status",
    description: "Find records that still need local confirmation.",
    icon: ShieldAlert,
    href: appModeHomeHref("forms", {
      query: "local confirmation required",
      focus: true,
      run: true,
    }),
  });
  return cards;
}

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

export function FormsHomePage({ defaultFormSlug = null }: { defaultFormSlug?: string | null }) {
  const taskCards = buildTaskCards(defaultFormSlug);
  const registry = useRegistryRecords("form", { view: "summary" });
  const registryReady = registry.status === "ready" || registry.status === "refetching";
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
      // Keep loading on startOnPhone so the seeded registry does not jump from
      // center → top when records arrive. Confirmed empty/error notices stay centred.
      contentAlign={registry.status === "loading" || hasRegistryRecords ? "startOnPhone" : "center"}
    >
      <ModeHomeTemplate
        testId="forms-home-template"
        title={sharedHomePresentation.forms.title}
        subtitle={sharedHomePresentation.forms.subtitle}
        icon={appModeIcons.forms}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Forms tasks"
        actions={hasRegistryRecords ? taskCards : []}
        pillsTitle="Browse by type"
        pills={hasRegistryRecords ? commonTasks : []}
        footer={hasRegistryRecords ? null : registryNotice}
      />
    </ModeHomeMain>
  );
}
