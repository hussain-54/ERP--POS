import { Card } from "@electronic-erp/ui";

export function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card
        title="Complete password reset"
        description="Open the reset link from your email. Supabase will establish a recovery session in this app route."
        className="w-full max-w-md"
      >
        <p className="text-sm text-[var(--erp-muted)]">
          After clicking the email link, update your password in Supabase Auth UI or a follow-up form in Phase 2.
        </p>
      </Card>
    </div>
  );
}
