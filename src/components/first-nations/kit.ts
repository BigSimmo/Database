/**
 * The one import point between First Nations and the shared mode kit
 * (src/components/mode-kit/). If a kit name, path or prop changes, change it
 * here and in the test double (tests/fixtures/first-nations-kit-double.tsx)
 * together. Never import from src/components/on-call/kit/.
 *
 * Two First Nations parts are re-exported here too, because each is a candidate
 * to move into the kit and should then only need this file changed:
 * - `FnLiveStatus`: the kit's `ModeStateLabel` has muted and warning tones only,
 *   with no live green state and no one-off pulse.
 * - `FnButton`: the kit's `ModeActionButton` is an icon-only in-row control, so
 *   a labelled action ("Add to letter", "Copy steps") has no kit part yet.
 */
export { ModeActionButton } from "@/components/mode-kit/action-button";
export { ModeDialRow } from "@/components/mode-kit/dial-row";
export { ModeDialSheet, type ModeDialNumber } from "@/components/mode-kit/dial-sheet";
export { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
export { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
export { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
export { ModeNotice } from "@/components/mode-kit/notice";
export { ModeStateLabel } from "@/components/mode-kit/state-label";
export { modeNameText, modeNumberText } from "@/components/mode-kit/type";
export { ModeUpdatedLine, type ModeSource } from "@/components/mode-kit/updated-line";

export { FnButton } from "@/components/first-nations/fn-button";
export { FnLiveStatus, type FnLiveTone } from "@/components/first-nations/live-status";
