import Link from "next/link";

import { PasswordRecoveryForm } from "@/components/clinical-dashboard/password-recovery-form";

export const metadata = { title: "Reset your password | PsychSift", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-lg px-5 py-12">
      <h1 className="text-2xl font-semibold text-[color:var(--text-heading)]">Reset your password</h1>
      <PasswordRecoveryForm />
      <Link href="/" className="mt-6 inline-flex min-h-tap items-center text-sm underline">
        Back to PsychSift
      </Link>
    </main>
  );
}
