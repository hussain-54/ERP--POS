import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Form, Input, useToast } from "@electronic-erp/ui";
import { AuthShell } from "./AuthShell";
import { authService } from "./auth-service";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(trimmed);
      setSent(true);
      toast.push({
        title: "Reset email sent",
        description: "Check your inbox for the reset link.",
        tone: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      toast.push({
        title: "Could not send reset email",
        description: message,
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll email a secure link so you can choose a new password."
      footer={
        <Link className="font-medium text-[var(--erp-brand)] hover:underline" to="/login">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div
            role="status"
            className="rounded-[var(--erp-radius)] border border-[var(--erp-success)]/25 bg-[var(--erp-success-soft)] px-3 py-2.5 text-sm text-[var(--erp-success)]"
          >
            If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setSent(false)}>
            Send another link
          </Button>
        </div>
      ) : (
        <Form onSubmit={onSubmit} noValidate>
          {error ? (
            <div
              role="alert"
              className="rounded-[var(--erp-radius)] border border-[var(--erp-danger)]/30 bg-[var(--erp-danger-soft)] px-3 py-2.5 text-sm text-[var(--erp-danger)]"
            >
              {error}
            </div>
          ) : null}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            error={emailError}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(undefined);
            }}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Send reset link
          </Button>
        </Form>
      )}
    </AuthShell>
  );
}
