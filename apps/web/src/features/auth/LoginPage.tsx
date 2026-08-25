import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Form, Input, useToast } from "@electronic-erp/ui";
import { useDocumentTitle } from "@/app/useDocumentTitle";
import { AuthShell } from "./AuthShell";
import { useAuth } from "./AuthContext";

const REMEMBER_EMAIL_KEY = "erp.auth.rememberEmail";

function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

type LoginLocationState = {
  from?: string;
  sessionExpired?: boolean;
  sessionExpiredMessage?: string;
};

export function LoginPage() {
  const { login, session, loading, sessionExpiredMessage, clearSessionExpiredMessage } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state as LoginLocationState | null) ?? null;
  const from = locState?.from ?? "/";
  useDocumentTitle("Sign in");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [expiredNotice, setExpiredNotice] = useState<string | null>(null);

  useEffect(() => {
    const remembered = readRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const fromNav =
      locState?.sessionExpiredMessage ??
      (locState?.sessionExpired ? "Your session has expired. Please sign in again." : null);
    if (fromNav) setExpiredNotice(fromNav);
  }, [locState?.sessionExpired, locState?.sessionExpiredMessage]);

  useEffect(() => {
    if (!sessionExpiredMessage) return;
    setExpiredNotice(sessionExpiredMessage);
    clearSessionExpiredMessage();
  }, [sessionExpiredMessage, clearSessionExpiredMessage]);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = "Email or username is required";
    else if (!trimmed.includes("@") && trimmed.length < 3) next.email = "Enter a valid email or username";
    else if (trimmed.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      next.email = "Enter a valid email address";
    }
    if (!password) next.password = "Password is required";
    else if (password.length < 4) next.password = "Password is too short";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const trimmed = email.trim();
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, trimmed);
        else localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {
        /* ignore storage failures */
      }

      await login({ email: trimmed, password });
      toast.push({ title: "Signed in", tone: "success" });
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      toast.push({ title: "Login failed", description: message, tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Enter your credentials to access your organization workspace."
      footer={
        <>
          Need help? Contact your system administrator.
        </>
      }
    >
      <Form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {expiredNotice ? (
          <div
            role="status"
            className="rounded-[var(--erp-radius)] border border-[var(--erp-brand)]/30 bg-[var(--erp-brand-soft)] px-3 py-2.5 text-sm text-[var(--erp-ink)]"
          >
            {expiredNotice}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-[var(--erp-radius)] border border-[var(--erp-danger)]/30 bg-[var(--erp-danger-soft)] px-3 py-2.5 text-sm text-[var(--erp-danger)]"
          >
            {error}
          </div>
        ) : null}

        <Input
          label="Email or username"
          type="text"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            error={fieldErrors.password}
            className="pr-16"
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
          />
          <button
            type="button"
            className="absolute right-2 top-[1.85rem] inline-flex h-9 min-h-9 items-center rounded-md px-2 text-xs font-semibold text-[var(--erp-brand)] hover:bg-[var(--erp-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)]"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--erp-ink)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--erp-border)] text-[var(--erp-brand)] focus:ring-[var(--erp-ring)]"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <Link
            className="min-h-11 inline-flex items-center text-sm font-medium text-[var(--erp-brand)] hover:underline"
            to="/auth/forgot-password"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={submitting} disabled={submitting || loading} className="mt-1 w-full">
          Sign in
        </Button>
      </Form>
    </AuthShell>
  );
}
