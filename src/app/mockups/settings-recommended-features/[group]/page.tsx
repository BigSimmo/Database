import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  SettingsRecommendedFeaturesMockupPage,
  SETTINGS_FEATURE_GROUPS,
  type SettingsFeatureGroupId,
} from "@/components/settings-recommended-features-mockups";

const GROUP_IDS = SETTINGS_FEATURE_GROUPS.map((group) => group.id);

type PageProps = {
  params: Promise<{ group: string }>;
};

export function generateStaticParams() {
  return GROUP_IDS.map((group) => ({ group }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { group: groupId } = await params;
  const group = SETTINGS_FEATURE_GROUPS.find((item) => item.id === groupId);
  if (!group) return { title: "Settings Feature Mockup - Clinical KB" };
  return {
    title: `${group.title} Settings Mockup - Clinical KB`,
    description: group.summary,
  };
}

export default async function SettingsRecommendedFeatureGroupMockupRoute({ params }: PageProps) {
  const { group: groupId } = await params;
  if (!GROUP_IDS.includes(groupId as SettingsFeatureGroupId)) notFound();
  return <SettingsRecommendedFeaturesMockupPage initialGroupId={groupId as SettingsFeatureGroupId} />;
}
