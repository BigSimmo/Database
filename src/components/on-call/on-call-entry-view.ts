import { type OnCallEntry } from "@/lib/on-call/entry-model";
import {
  type OnCallPageView,
  onCallViewForEntry as libOnCallViewForEntry,
  onCallViewStorageSection as libOnCallViewStorageSection,
} from "@/lib/on-call/view";
import { onCallEntryAnchorId } from "@/components/on-call/on-call-page-anchors";
import { ON_CALL_VIEW_HREFS } from "@/components/on-call/on-call-section-identity";

export type { OnCallPageView };

export function onCallViewStorageSection(view: OnCallPageView) {
  return libOnCallViewStorageSection(view);
}

export function onCallViewForEntry(entry: OnCallEntry): OnCallPageView {
  return libOnCallViewForEntry(entry);
}

export function onCallEntryHref(entry: OnCallEntry): string {
  return `${ON_CALL_VIEW_HREFS[onCallViewForEntry(entry)]}#${onCallEntryAnchorId(entry.id)}`;
}
