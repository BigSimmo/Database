import { notFound } from "next/navigation";

import {
  SYNTHETIC_PRESENTATION_PARAMS,
  isSyntheticPresentationForPatient,
} from "@/components/care-plan/mockups/routes";

import { CarePlanRoutePage } from "../../../../route-page";

export function generateStaticParams() {
  return [...SYNTHETIC_PRESENTATION_PARAMS];
}

/**
 * An episode belongs to exactly one patient, so a real episode identifier under
 * the wrong patient is still an address that does not exist and must not render.
 */
export default async function CarePlanPresentationPage({
  params,
}: {
  params: Promise<{ patientId: string; presentationId: string }>;
}) {
  const { patientId, presentationId } = await params;
  if (!isSyntheticPresentationForPatient(patientId, presentationId)) notFound();
  return <CarePlanRoutePage />;
}
