import type { LucideIcon } from "lucide-react";

import { categoryIconComponent } from "@/lib/category-identity-icons";
import type { AppModeId } from "@/lib/app-modes";
import { APP_MODE_ICON } from "@/lib/category-identity";

/**
 * Canonical Lucide icons for each app mode — nav, universal search, favourites.
 *
 * The choices now live in `src/lib/category-identity.ts` alongside the tool and
 * factsheet axes, so "keep in sync" is a property of the type rather than a
 * comment: this record is derived, not maintained. The export name and shape are
 * unchanged, so consumers need no edit.
 */
export const appModeIcons: Record<AppModeId, LucideIcon> = Object.fromEntries(
  Object.entries(APP_MODE_ICON).map(([mode, icon]) => [mode, categoryIconComponent(icon)]),
) as Record<AppModeId, LucideIcon>;
