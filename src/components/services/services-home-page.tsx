"use client";

import { FileQuestion, FileSearch, Loader2, MapPinned, Route, ShieldAlert, Users } from "lucide-react";

import {
  ModeHomeMain,
  ModeHomeStatusNotice,
  ModeHomeTemplate,
  type ModeHomeAction,
  type ModeHomePill,
} from "@/components/mode-home-template";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { useRegistryRecords } from "@/lib/use-registry-records";

// The default service slug is computed server-side (app/services/page.tsx) and
// passed as a prop: a direct `@/lib/services` value import here would compile
// the full services snapshot (~100 KB gzip) into this client route chunk.
function buildTaskCards(defaultServiceSlug: string | null): ModeHomeAction[] {
  const cards: ModeHomeAction[] = [
    {
      title: "Search services",
      description: "Need, catchment, provider, keyword.",
      icon: FileSearch,
      href: appModeHomeHref("services", { focus: true }),
    },
  ];

  if (defaultServiceSlug) {
    cards.push({
      title: "Check catchment",
      description: "Region, public/private, eligibility.",
      icon: MapPinned,
      href: `${appModeHomeHref("services")}/${defaultServiceSlug}`,
    });
  }

  cards.push({
    title: "Browse referral pathways",
    description: "Crisis, youth, Aboriginal health, telehealth.",
    icon: Route,
    href: appModeHomeHref("services", {
      query: "crisis youth Aboriginal health telehealth referral pathway",
      focus: true,
      run: true,
    }),
  });

  return cards;
}

const commonPathways: ModeHomePill[] = [
  {
    label: "Crisis",
    tone: "danger",
    href: appModeHomeHref("services", { query: "crisis support services", focus: true, run: true }),
  },
  {
    label: "Aboriginal and Torres Strait Islander services",
    shortLabel: "ATSI services",
    tone: "rose",
    href: appModeHomeHref("services", {
      query: "Aboriginal Torres Strait Islander services",
      focus: true,
      run: true,
    }),
  },
  {
    label: "Youth",
    tone: "purple",
    href: appModeHomeHref("services", { query: "youth mental health services", focus: true, run: true }),
  },
  {
    label: "Telehealth",
    tone: "indigo",
    href: appModeHomeHref("services", { query: "telehealth services", focus: true, run: true }),
  },
  {
    label: "Free",
    tone: "slate",
    href: appModeHomeHref("services", { query: "free services", focus: true, run: true }),
  },
  {
    label: "Statewide",
    tone: "neutral",
    href: appModeHomeHref("services", { query: "statewide services", focus: true, run: true }),
  },
];

export function ServicesHomePage({ defaultServiceSlug = null }: { defaultServiceSlug?: string | null }) {
  const taskCards = buildTaskCards(defaultServiceSlug);
  const registry = useRegistryRecords("service", { view: "summary" });
  const registryReady = registry.status === "ready" || registry.status === "refetching";
  const hasRegistryRecords = registryReady && registry.total > 0;
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
      <ModeHomeTemplate
        testId="services-home-template"
        title="Services"
        subtitle="Search by need, catchment, or route."
        icon={Users}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Service tasks"
        actions={hasRegistryRecords ? taskCards : []}
        pillsTitle="Browse by need"
        pills={hasRegistryRecords ? commonPathways : []}
        footer={hasRegistryRecords ? null : registryNotice}
      />
    </ModeHomeMain>
  );
}
