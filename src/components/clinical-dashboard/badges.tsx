import { CircleAlert, CircleCheck, FileText, Loader2 } from "lucide-react";

import { cn, toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";

function statusTone(status: string) {
  if (status === "indexed" || status === "completed") {
    return {
      icon: CircleCheck,
      className: toneSuccess,
    };
  }
  if (status === "failed") {
    return {
      icon: CircleAlert,
      className: toneDanger,
    };
  }
  if (status === "processing") {
    return {
      icon: Loader2,
      className: toneInfo,
    };
  }
  return {
    icon: FileText,
    className: toneNeutral,
  };
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold",
        tone.className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "processing" && "animate-spin")} />
      {status}
    </span>
  );
}

export function StrengthBadge({ strength }: { strength?: string }) {
  const label = strength ?? "source";
  const className = strength === "strong" ? toneSuccess : strength === "limited" ? toneWarning : toneInfo;
  // A checkmark implies "verified"; limited support is a caution, so pair the
  // warning tone with a caution icon rather than a misleading tick.
  const Icon = strength === "limited" ? CircleAlert : CircleCheck;

  return (
    <span
      className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold", className)}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
