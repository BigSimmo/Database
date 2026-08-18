import {
  Activity,
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
import { createElement } from "react";

import type { FactsheetIconKey } from "@/components/factsheets/factsheets-data";

/** Stable icon-key → Lucide component map for per-sheet icons. */
const factsheetIcons: Record<FactsheetIconKey, LucideIcon> = {
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

/**
 * Render a Lucide glyph without binding a capitalised component to a render-body
 * local (which `react-hooks/static-components` forbids).
 */
export function factsheetGlyph(icon: FactsheetIconKey, className: string) {
  return createElement(factsheetIcons[icon], { className, "aria-hidden": "true" });
}
