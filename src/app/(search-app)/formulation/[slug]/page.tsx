import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormulationMechanismPage } from "@/components/formulation/formulation-mechanism-page";
import { findFormulationMechanism, formulationMechanisms } from "@/lib/formulation";

export const dynamicParams = false;

export function generateStaticParams() {
  return formulationMechanisms.map((mechanism) => ({ slug: mechanism.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mechanism = findFormulationMechanism(slug);
  return {
    title: mechanism ? `${mechanism.name} — Formulation` : "Formulation mechanism not found",
    description: mechanism?.summary,
  };
}

export default async function FormulationMechanismRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mechanism = findFormulationMechanism(slug);
  if (!mechanism) notFound();
  return <FormulationMechanismPage mechanism={mechanism} />;
}
