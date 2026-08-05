"use client";

import { useEffect, useState } from "react";

import {
  commandDropdownCanDisplay,
  commandDropdownMinimumWidthMediaQuery,
  commandDropdownPointerMediaQuery,
  type CommandSurfacePlacement,
} from "@/lib/search-command-surface";

const commandSurfacePlacements: readonly CommandSurfacePlacement[] = ["bottom-dock", "inline"];

const undisplayableByPlacement: Record<CommandSurfacePlacement, boolean> = {
  "bottom-dock": false,
  inline: false,
};

/**
 * Shared displayability for the universal command dropdown. Both the header
 * (scrim / pins-menu gate) and the command surface must agree on when the
 * panel can render — width + fine pointer / zero-touch.
 */
export function useCommandDropdownDisplayableByPlacement() {
  const [displayableByPlacement, setDisplayableByPlacement] =
    useState<Record<CommandSurfacePlacement, boolean>>(undisplayableByPlacement);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const minimumWidthMediaByPlacement = Object.fromEntries(
      commandSurfacePlacements.map((placement) => [
        placement,
        window.matchMedia(commandDropdownMinimumWidthMediaQuery(placement)),
      ]),
    ) as Record<CommandSurfacePlacement, MediaQueryList>;
    const pointerMedia = window.matchMedia(commandDropdownPointerMediaQuery);
    const sync = () => {
      setDisplayableByPlacement({
        "bottom-dock": commandDropdownCanDisplay({
          minimumWidthMatches: minimumWidthMediaByPlacement["bottom-dock"].matches,
          pointerMatches: pointerMedia.matches,
          maxTouchPoints: navigator.maxTouchPoints,
        }),
        inline: commandDropdownCanDisplay({
          minimumWidthMatches: minimumWidthMediaByPlacement.inline.matches,
          pointerMatches: pointerMedia.matches,
          maxTouchPoints: navigator.maxTouchPoints,
        }),
      });
    };
    sync();
    for (const media of Object.values(minimumWidthMediaByPlacement)) media.addEventListener("change", sync);
    pointerMedia.addEventListener("change", sync);
    return () => {
      for (const media of Object.values(minimumWidthMediaByPlacement)) media.removeEventListener("change", sync);
      pointerMedia.removeEventListener("change", sync);
    };
  }, []);

  return displayableByPlacement;
}

export function useCommandDropdownDisplayable(placement: CommandSurfacePlacement, onUndisplayable?: () => void) {
  const [displayable, setDisplayable] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const minimumWidthMedia = window.matchMedia(commandDropdownMinimumWidthMediaQuery(placement));
    const pointerMedia = window.matchMedia(commandDropdownPointerMediaQuery);
    const sync = () => {
      const next = commandDropdownCanDisplay({
        minimumWidthMatches: minimumWidthMedia.matches,
        pointerMatches: pointerMedia.matches,
        maxTouchPoints: navigator.maxTouchPoints,
      });
      setDisplayable(next);
      if (!next) onUndisplayable?.();
    };
    sync();
    minimumWidthMedia.addEventListener("change", sync);
    pointerMedia.addEventListener("change", sync);
    return () => {
      minimumWidthMedia.removeEventListener("change", sync);
      pointerMedia.removeEventListener("change", sync);
    };
  }, [placement, onUndisplayable]);

  return displayable;
}
