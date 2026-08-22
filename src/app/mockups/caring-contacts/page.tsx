import type { Metadata } from "next";

import { CaringContactRoutePage } from "./route-page";

export const metadata: Metadata = {
  title: "Caring Contact prototype · Clinical KB",
  description: "A fully synthetic, one-way Caring Contact coordination prototype.",
};

export default function CaringContactTodayPage() {
  return <CaringContactRoutePage />;
}
