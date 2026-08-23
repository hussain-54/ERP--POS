import { Link } from "react-router-dom";
import { AuthShell } from "./AuthShell";

export function ResetPasswordPage() {
  return (
    <AuthShell
      title="Complete password reset"
      subtitle="Open the reset link from your email to establish a secure recovery session."
      footer={
        <Link className="font-medium text-[var(--erp-brand)] hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--erp-muted)]">
        After you open the email link, you can finish setting a new password in this workspace. If the link has
        expired, request a fresh one from the forgot-password page.
      </p>
      <div className="mt-5">
        <Link
          to="/auth/forgot-password"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--erp-radius)] bg-[var(--erp-brand)] px-4 text-sm font-medium text-white hover:bg-[var(--erp-brand-hover)]"
        >
          Request a new link
        </Link>
      </div>
    </AuthShell>
  );
}
