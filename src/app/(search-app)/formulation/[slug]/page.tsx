import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormulationConceptPage } from "@/components/formulation/formulation-concept-page";
import { FormulationMechanismPage } from "@/components/formulation/formulation-mechanism-page";
import { findFormulationMechanism, formulationMechanisms } from "@/lib/formulation";
import {
  publishedFormulationConcepts,
  publishedFormulationGuides,
  publishedFormulationRecord,
} from "@/lib/formulation-concepts";

export const dynamicParams = false;

/**
 * One slug space for the whole library. Mechanisms keep the 12 slugs they
 * already own; the contextual concepts and guide modules join them rather than
 * opening a second route family, so every existing `/formulation/<slug>` link
 * keeps working and nothing new has to be taught. A record held for governance
 * review is absent from this list, so it 404s rather than rendering.
 */
export function generateStaticParams() {
  return [
    ...formulationMechanisms.map((mechanism) => ({ slug: mechanism.id })),
    ...publishedFormulationConcepts.map((concept) => ({ slug: concept.id })),
    ...publishedFormulationGuides.map((guide) => ({ slug: guide.id })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mechanism = findFormulationMechanism(slug);
  if (mechanism) {
    return { title: `${mechanism.name} — Formulation`, description: mechanism.summary };
  }
  const record = publishedFormulationRecord(slug);
  if (record) {
    return { title: `${record.title} — Formulation`, description: record.summary };
  }
  return { title: "Formulation record not found" };
}

export default async function FormulationRecordRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mechanism = findFormulationMechanism(slug);
  if (mechanism) return <FormulationMechanismPage mechanism={mechanism} />;
  const record = publishedFormulationRecord(slug);
  if (!record) notFound();
  return <FormulationConceptPage record={record} />;
}
