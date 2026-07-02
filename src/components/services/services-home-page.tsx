"use client";

import { FileSearch, MapPinned, Route, Users } from "lucide-react";

import {
  ModeHomeMain,
  ModeHomeTemplate,
  ModeHomeVerificationFooter,
  type ModeHomeAction,
  type ModeHomePill,
} from "@/components/mode-home-template";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { defaultServiceSlug } from "@/lib/services";
import { countVerifiedRegistryRecords, useRegistryRecords } from "@/lib/use-registry-records";

const taskCards: ModeHomeAction[] = [
  {
    title: "Search services",
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

const commonPathways: ModeHomePill[] = [
  {
    label: "Crisis",
    tone: "danger",
    href: appModeHomeHref("services", { query: "crisis support services", focus: true, run: true }),
  },
  {
    label: "Aboriginal and Torres Strait Islander",
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

export function ServicesHomePage() {
  const registry = useRegistryRecords("service");
  const verifiedCount = countVerifiedRegistryRecords(registry);

  return (
    <ModeHomeMain testId="services-home">
      <ModeHomeTemplate
        testId="services-home-template"
        title="Find a service"
        subtitle="Search by need, catchment, referral route, or provider."
        icon={Users}
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actionsLabel="Service tasks"
        actions={taskCards}
        pillsTitle="Common pathways"
        pills={commonPathways}
        footer={
          registry.status === "ready" ? (
            <ModeHomeVerificationFooter
              label="Catalogue service data"
              body="Confirm locally before use"
              verifiedCount={verifiedCount}
              totalCount={registry.total}
            />
          ) : null
        }
      />
    </ModeHomeMain>
  );
}
