"use client";

import Link from "next/link";

import { cn } from "@/components/ui-primitives";

import styles from "./care-plan.module.css";
import { carePlanRoute } from "./routes";

export type PatientSectionKey = "overview" | "managementPlan" | "safetyPlan" | "presentations" | "history";

/**
 * The four primary patient sections plus `History`, which stays available as a
 * secondary audit surface rather than competing with them for attention.
 *
 * Every href is rebuilt from the selected patient's identifier through the route
 * registry, so no synthetic identifier is written out here and a link can never
 * point at a different patient than the workspace around it.
 */
const PRIMARY_SECTIONS: readonly { key: PatientSectionKey; label: string; href: (id: string) => string }[] = [
  { key: "overview", label: "Overview", href: carePlanRoute.patient },
  { key: "managementPlan", label: "Management Plan", href: carePlanRoute.managementPlan },
  { key: "safetyPlan", label: "Personal Safety Plan", href: carePlanRoute.safetyPlan },
  { key: "presentations", label: "ED Presentations", href: carePlanRoute.presentations },
];

const SECONDARY_SECTION = { key: "history" as const, label: "History", href: carePlanRoute.history };

export function PatientNavigation({
  patientId,
  activeSection,
}: {
  patientId: string;
  activeSection: PatientSectionKey;
}) {
  return (
    <nav aria-label="Patient sections" className={styles.patientNav} data-print-hide="true">
      {PRIMARY_SECTIONS.map(({ key, label, href }) => (
        <Link
          key={key}
          href={href(patientId)}
          aria-current={activeSection === key ? "page" : undefined}
          className={styles.patientNavItem}
        >
          {label}
        </Link>
      ))}
      <Link
        href={SECONDARY_SECTION.href(patientId)}
        aria-current={activeSection === SECONDARY_SECTION.key ? "page" : undefined}
        className={cn(styles.patientNavItem, styles.patientNavSecondary)}
      >
        {SECONDARY_SECTION.label}
      </Link>
    </nav>
  );
}
