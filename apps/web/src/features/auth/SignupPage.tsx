import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button, Form, Input, useToast } from "@electronic-erp/ui";
import { useDocumentTitle } from "@/app/useDocumentTitle";
import { AuthShell } from "./AuthShell";
import { useAuth } from "./AuthContext";

export function SignupPage() {
  const { signup, session, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  useDocumentTitle("Create Account");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  function validate(): boolean {
    const next: typeof fieldErrors = {};

    const trimmedName = fullName.trim();
    if (!trimmedName) next.fullName = "Full name is required";
    else if (trimmedName.length < 2) next.fullName = "Full name must be at least 2 characters";

    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address";
    }

    const trimmedCompany = companyName.trim();
    if (!trimmedCompany) next.companyName = "Company or business name is required";
    else if (trimmedCompany.length < 2) next.companyName = "Company name must be at least 2 characters";

    const trimmedPhone = phone.trim();
    if (trimmedPhone && trimmedPhone.length > 50) {
      next.phone = "Phone number is too long";
    }

    if (!password) {
      next.password = "Password is required";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters long";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Confirm your password";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        companyName: companyName.trim(),
        password,
        confirmPassword,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      toast.push({
        title: "Account created successfully",
        description: `Welcome to ${companyName.trim()}`,
        tone: "success",
      });
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
      if (message.toLowerCase().includes("email") || message.toLowerCase().includes("exists")) {
        setFieldErrors((prev) => ({
          ...prev,
          email: "This email is already registered. Sign in or use a different email.",
        }));
      }
      toast.push({ title: "Signup failed", description: message, tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create ERP Account"
      subtitle="Register your organization and start managing sales, inventory, and operations."
      footer={
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <span>Already have an account?</span>
          <Link
            to="/login"
            className="font-medium text-[var(--erp-brand)] hover:underline"
          >
            Sign in here
          </Link>
        </div>
      }
    >
      <Form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error ? (
          <div
            role="alert"
            className="rounded-[var(--erp-radius)] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0 text-xs" aria-hidden />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <Input
            label="Full Name *"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
            }}
            placeholder="e.g. Muhammad Ali"
            disabled={submitting}
          />
          {fieldErrors.fullName ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.fullName}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Work Email *"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="name@company.com"
            disabled={submitting}
          />
          {fieldErrors.email ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Company / Business Name *"
              name="companyName"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (fieldErrors.companyName) setFieldErrors((p) => ({ ...p, companyName: undefined }));
              }}
              placeholder="e.g. ABC Electronics"
              disabled={submitting}
            />
            {fieldErrors.companyName ? (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.companyName}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Phone Number"
              type="tel"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
              }}
              placeholder="+92 300 1234567"
              disabled={submitting}
            />
            {fieldErrors.phone ? (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.phone}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <div className="relative">
            <Input
              label="Password *"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder="Min. 8 characters"
              disabled={submitting}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-8 text-xs text-[var(--erp-muted)] hover:text-[var(--erp-ink)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden />
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>
          ) : (
            <p className="text-[11px] text-[var(--erp-muted)]">Minimum 8 characters with numbers or symbols.</p>
          )}
        </div>

        <div className="space-y-1">
          <div className="relative">
            <Input
              label="Confirm Password *"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
              placeholder="Repeat your password"
              disabled={submitting}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-8 text-xs text-[var(--erp-muted)] hover:text-[var(--erp-ink)]"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              <i className={`fa-solid ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden />
            </button>
          </div>
          {fieldErrors.confirmPassword ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Profile Image URL (Optional)"
            type="url"
            name="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            disabled={submitting}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="mt-2 h-11 w-full justify-center text-sm font-semibold shadow-sm"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden />
              Creating workspace…
            </span>
          ) : (
            "Create Account & Start"
          )}
        </Button>
      </Form>
    </AuthShell>
  );
}
