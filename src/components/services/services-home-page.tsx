import { FileSearch, MapPinned, Route, Users } from "lucide-react";

import {
  CompactRecordHomePage,
  type CompactHomeAction,
  type CompactHomePill,
} from "@/components/compact-record-home-page";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { defaultServiceSlug, serviceRecords } from "@/lib/services";

const taskCards: CompactHomeAction[] = [
  {
    title: "Find a service",
    description: "Search by need, catchment, provider, or keyword.",
    icon: FileSearch,
    href: appModeHomeHref("services", { focus: true }),
  },
  {
    title: "Check catchment",
    description: "Confirm region, public/private, and eligibility.",
    icon: MapPinned,
    href: `/services/${defaultServiceSlug() ?? ""}`,
  },
  {
    title: "Browse referral pathways",
    description: "Crisis, youth, Aboriginal health, telehealth.",
    icon: Route,
    href: appModeHomeHref("services", {
      query: "crisis youth Aboriginal health telehealth referral pathway",
      focus: true,
      run: true,
    }),
  },
];

const commonPathways: CompactHomePill[] = [
  {
    label: "Crisis",
    tone: "danger",
    href: appModeHomeHref("services", { query: "crisis support services", focus: true, run: true }),
  },
  {
    label: "ATSI-specific",
    tone: "info",
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
    tone: "primary",
    href: appModeHomeHref("services", { query: "telehealth services", focus: true, run: true }),
  },
  {
    label: "Free",
    tone: "success",
    href: appModeHomeHref("services", { query: "free services", focus: true, run: true }),
  },
  {
    label: "Statewide",
    tone: "neutral",
    href: appModeHomeHref("services", { query: "statewide services", focus: true, run: true }),
  },
];

function verifiedCount() {
  return serviceRecords.filter((service) => service.verification?.locallyVerified).length;
}

export function ServicesHomePage() {
  return (
    <CompactRecordHomePage
      testId="services-home"
      title="Find a service"
      subtitle="Search by need, catchment, referral route, or provider."
      icon={Users}
      tasksLabel="Service tasks"
      taskCards={taskCards}
      quickLinksTitle="Common pathways"
      quickLinks={commonPathways}
      verificationLabel="Catalogue service data"
      verificationBody="Confirm locally before use"
      verifiedCount={verifiedCount()}
      totalCount={serviceRecords.length}
      desktopComposerSlotId={modeHomeDesktopComposerSlotId}
    />
  );
}
