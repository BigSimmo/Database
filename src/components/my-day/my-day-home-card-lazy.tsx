"use client";

import dynamic from "next/dynamic";

import { useOptionalAccountData } from "@/components/account-data-provider";

/**
 * The home screen's My Day card, loaded only for a signed-in reader and only
 * in the browser: its reads are the reader's own records, so there is nothing
 * to server-render, and a signed-out visitor never downloads it at all.
 * The card itself renders nothing until it has items, so the home layout
 * never moves for a reader with nothing due.
 */
const MyDayHomeCard = dynamic(
  () => import("@/components/my-day/my-day-home-card").then((module) => module.MyDayHomeCard),
  { ssr: false },
);

export function LazyMyDayHomeCard() {
  // Optional: the home renders in tests and shells without the account provider.
  const isAuthenticated = useOptionalAccountData()?.isAuthenticated ?? false;
  return isAuthenticated ? <MyDayHomeCard /> : null;
}
