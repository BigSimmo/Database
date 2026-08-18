"use client";

import Link from "next/link";
import { useId } from "react";
import {
  Activity,
  BedSingle,
  CircleAlert,
  FileCheck2,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  ListFilter,
  MapPinned,
  MessageSquarePlus,
  Pill,
  Route,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Waypoints,
  Wrench,
} from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";

import shellStyles from "./ward-management.module.css";
import modeStyles from "./ward-management-modes.module.css";

export type WardMode =
  | "command"
  | "constellation"
  | "network"
  | "queue"
  | "capacity"
  | "movements"
  | "exceptions"
  | "transport"
  | "governance";

function RailLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={active ? shellStyles.railLinkActive : shellStyles.railLink}
    >
      {children}
    </Link>
  );
}

function RailPlaceholder({ label, children }: { label: string; children: React.ReactNode }) {
  const unavailableId = useId();
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={`${label} — coming soon`}
        aria-disabled="true"
        aria-describedby={unavailableId}
        onClick={ignoreUnavailableActivation}
        className={shellStyles.railLink}
      >
        {children}
      </button>
      <span id={unavailableId} className="sr-only">
        {label} is not available in this prototype yet.
      </span>
    </>
  );
}

export function ClinicalRail() {
  return (
    <aside className={shellStyles.clinicalRail} aria-label="Clinical KB">
      <Link href="/" className={shellStyles.railBrand} aria-label="Clinical KB home">
        <BrandMark className={shellStyles.brandGlyph} />
      </Link>
      <div className={shellStyles.railRule} aria-hidden="true" />
      <nav className={shellStyles.railNav} aria-label="Clinical applications">
        <RailLink href="/?mode=answer" label="Clinical Answers">
          <MessageSquarePlus aria-hidden="true" />
        </RailLink>
        <RailLink href="/ward-management" label="Ward Flow" active>
          <Activity aria-hidden="true" />
        </RailLink>
        <RailLink href="/documents" label="Documents">
          <FileCheck2 aria-hidden="true" />
        </RailLink>
        <RailLink href="/services" label="Services">
          <SlidersHorizontal aria-hidden="true" />
        </RailLink>
        <RailLink href="/medications" label="Medication">
          <Pill aria-hidden="true" />
        </RailLink>
        <RailLink href="/tools" label="Tools">
          <Wrench aria-hidden="true" />
        </RailLink>
        <RailLink href="/tools" label="All applications">
          <LayoutGrid aria-hidden="true" />
        </RailLink>
      </nav>
      <div className={shellStyles.railBottom}>
        <RailLink href="/favourites" label="Favourites">
          <HeartPulse aria-hidden="true" />
        </RailLink>
        <RailPlaceholder label="Settings">
          <Settings aria-hidden="true" />
        </RailPlaceholder>
        <span className={shellStyles.avatar} aria-label="Guest workspace">
          G
        </span>
      </div>
    </aside>
  );
}

export function WardModeNavigation({ active }: { active: WardMode }) {
  return (
    <nav className={modeStyles.modeNavigation} aria-label="Ward Flow views">
      <Link
        href="/ward-management"
        aria-current={active === "command" ? "page" : undefined}
        className={active === "command" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <LayoutDashboard aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Command</span>
        <span className={modeStyles.modeShortLabel}>Home</span>
      </Link>
      <Link
        href="/ward-management/constellation"
        aria-current={active === "constellation" ? "page" : undefined}
        className={active === "constellation" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <MapPinned aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Constellation</span>
        <span className={modeStyles.modeShortLabel}>Map</span>
      </Link>
      <Link
        href="/ward-management/network"
        aria-current={active === "network" ? "page" : undefined}
        className={active === "network" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <Waypoints aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Network</span>
        <span className={modeStyles.modeShortLabel}>Graph</span>
      </Link>
      <Link
        href="/ward-management/queue"
        aria-current={active === "queue" ? "page" : undefined}
        className={active === "queue" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <ListFilter aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Priority queue</span>
        <span className={modeStyles.modeShortLabel}>Queue</span>
      </Link>
      <Link
        href="/ward-management/capacity"
        aria-current={active === "capacity" ? "page" : undefined}
        className={active === "capacity" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <BedSingle aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Capacity</span>
        <span className={modeStyles.modeShortLabel}>Beds</span>
      </Link>
      <Link
        href="/ward-management/movements"
        aria-current={active === "movements" ? "page" : undefined}
        className={active === "movements" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <Route aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Movements</span>
        <span className={modeStyles.modeShortLabel}>Flow</span>
      </Link>
      <Link
        href="/ward-management/exceptions"
        aria-current={active === "exceptions" ? "page" : undefined}
        className={active === "exceptions" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <CircleAlert aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Exceptions</span>
        <span className={modeStyles.modeShortLabel}>Inbox</span>
      </Link>
      <Link
        href="/ward-management/transport"
        aria-current={active === "transport" ? "page" : undefined}
        className={active === "transport" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <Truck aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Transport</span>
        <span className={modeStyles.modeShortLabel}>Move</span>
      </Link>
      <Link
        href="/ward-management/governance"
        aria-current={active === "governance" ? "page" : undefined}
        className={active === "governance" ? modeStyles.modeLinkActive : modeStyles.modeLink}
      >
        <ShieldCheck aria-hidden="true" />
        <span className={modeStyles.modeLabel}>Governance</span>
        <span className={modeStyles.modeShortLabel}>Assure</span>
      </Link>
    </nav>
  );
}
