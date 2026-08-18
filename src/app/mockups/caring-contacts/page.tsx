import type { Metadata } from "next";

import { CaringContactDesignSuite } from "@/components/caring-contacts/mockups";

export const metadata: Metadata = {
  title: "Synthetic caring-contact design suite",
  description: "Fictional-only caring-contact coordination design foundation.",
};

export default function CaringContactsMockupPage() {
  return <CaringContactDesignSuite />;
}
