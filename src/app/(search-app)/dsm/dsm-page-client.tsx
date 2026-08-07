"use client";

import dynamic from "next/dynamic";

import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";

const DsmHomePage = dynamic(() => import("@/components/dsm/dsm-home-page").then((mod) => mod.DsmHomePage), {
  ssr: false,
  loading: () => <ModeHomeRouteLoading />,
});

export default function DsmPageClient() {
  return <DsmHomePage />;
}
