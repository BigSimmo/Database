import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  SettingsRecommendedFeaturesMockupPage,
  type SettingsFeatureGroupId,
} from "@/components/settings-recommended-features-mockups";

const GROUPS: ReadonlyArray<{
  id: SettingsFeatureGroupId;
  title: string;
  summary: string;
}> = [
  {
    id: "source-evidence",
    title: "Source & evidence",
    summary: "Control how answers prefer, show, and reconcile clinical sources.",
  },
  {
    id: "answer-reading",
    title: "Answer reading",
    summary: "Make answers easier to verify, copy, and read in clinical settings.",
  },
  {
    id: "clinical-workflow",
    title: "Clinical workflow",
    summary: "Start in the right mode and keep practice context ready without PHI.",
  },
  {
    id: "privacy-trust",
    title: "Privacy & trust",
    summary: "Keep the app honest about data mode, sync, and PHI boundaries.",
  },
  {
    id: "productivity",
    title: "Productivity",
    summary: "Speed up repeated clinical lookups and document review habits.",
  },
  {
    id: "accessibility-device",
    title: "Accessibility / device",
    summary: "Tune display and device behaviour for ward phones and shared workstations.",
  },
];

type PageProps = {
  params: Promise<{ group: string }>;
};

export function generateStaticParams() {
  return GROUPS.map((group) => ({ group: group.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { group: groupId } = await params;
  const group = GROUPS.find((item) => item.id === groupId);
  if (!group) return { title: "Settings Feature Mockup - Clinical KB" };
  return {
    title: `${group.title} Settings Mockup - Clinical KB`,
    description: group.summary,
  };
}

export default async function SettingsRecommendedFeatureGroupMockupRoute({ params }: PageProps) {
  const { group: groupId } = await params;
  const group = GROUPS.find((item) => item.id === groupId);
  if (!group) notFound();
  return <SettingsRecommendedFeaturesMockupPage initialGroupId={group.id} />;
}
