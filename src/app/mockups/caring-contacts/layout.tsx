import type { ReactNode } from "react";

import { CaringContactPrototypeProvider } from "@/components/caring-contacts/mockups/routable-suite";
import { DeveloperAreaGate } from "@/components/developer-area/developer-area-gate";

export default function CaringContactMockupLayout({ children }: { children: ReactNode }) {
  return (
    <DeveloperAreaGate>
      <CaringContactPrototypeProvider>{children}</CaringContactPrototypeProvider>
    </DeveloperAreaGate>
  );
}
