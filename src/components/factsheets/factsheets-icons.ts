import {
  Activity,
  BrainCircuit,
  ClipboardList,
  CloudRain,
  Droplet,
  HeartPulse,
  Layers,
  MessageSquareText,
  MessagesSquare,
  Pill,
  Tablets,
  Wind,
  type LucideIcon,
} from "lucide-react";

import type { FactsheetCategory, FactsheetIconKey } from "@/components/factsheets/factsheets-data";

/** Stable icon-key → Lucide component map for per-sheet icons. */
export const factsheetIcons: Record<FactsheetIconKey, LucideIcon> = {
  capsule: Pill,
  pill: Pill,
  layers: Layers,
  tablet: Tablets,
  cloudRain: CloudRain,
  worry: Wind,
  swings: Activity,
  chatCheck: MessageSquareText,
  chat: MessagesSquare,
  heart: HeartPulse,
  droplet: Droplet,
};

/** Category browse icons for the home topic pills. */
export const factsheetCategoryIcons: Record<FactsheetCategory, LucideIcon> = {
  Medications: Pill,
  Conditions: BrainCircuit,
  Therapies: MessagesSquare,
  "Tests & procedures": ClipboardList,
};

export function factsheetIcon(key: FactsheetIconKey): LucideIcon {
  return factsheetIcons[key];
}
