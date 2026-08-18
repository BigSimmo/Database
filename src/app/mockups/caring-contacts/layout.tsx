import type { ReactNode } from "react";

import { CaringContactPrototypeProvider } from "@/components/caring-contacts/mockups/routable-suite";

export default function CaringContactMockupLayout({ children }: { children: ReactNode }) {
  return <CaringContactPrototypeProvider>{children}</CaringContactPrototypeProvider>;
}
