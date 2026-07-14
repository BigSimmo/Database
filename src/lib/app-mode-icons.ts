import {
  BookOpenCheck,
  BrainCircuit,
  FileSignature,
  FileText,
  Heart,
  Pill,
  Route,
  Tags,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { AppModeId } from "@/lib/app-modes";

/** Canonical Lucide icons for each app mode — keep in sync across nav, search, and favourites. */
export const appModeIcons: Record<AppModeId, LucideIcon> = {
  answer: Sparkles,
  documents: FileText,
  services: Route,
  forms: FileSignature,
  favourites: Heart,
  differentials: BrainCircuit,
  dsm: BookOpenCheck,
  specifiers: Tags,
  prescribing: Pill,
  tools: Wrench,
};
