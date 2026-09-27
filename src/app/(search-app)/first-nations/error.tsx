"use client";
// Error boundaries must be client components. The shell's universal header stays above
// this boundary; the page and its tabs are replaced, and the crisis strip stays.
import { CrisisStrip } from "@/components/first-nations/crisis";
import { StateModule } from "@/components/first-nations/state-module";

export default function FirstNationsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto grid w-full max-w-[40rem] content-start gap-3 px-3 pt-3">
      <StateModule kind="error" onAction={() => retry()} />
      <CrisisStrip />
    </div>
  );
}
