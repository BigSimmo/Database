"use client";
import { OnCallCrisisLines } from "@/components/on-call/call/external-line-rows";
/** Shared public crisis contacts for every On Call page. */
export function NowCrisisLines({ now }: { readonly now?: Date }) {
  return <OnCallCrisisLines now={now} testId="on-call-now-crisis" />;
}
