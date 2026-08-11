import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Form, Input, useToast } from "@electronic-erp/ui";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login, session, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
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
    <div className="grid min-h-screen place-items-center px-4">
      <Card
        className="w-full max-w-md"
        title="Electronic ERP"
        description="Sign in to your organization workspace."
      >
        <Form onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-sm text-[var(--erp-danger)]">{error}</p> : null}
          <Button type="submit" loading={submitting} className="w-full">
            Sign in
          </Button>
          <p className="text-center text-sm text-[var(--erp-muted)]">
            <Link className="text-[var(--erp-brand)] underline" to="/auth/forgot-password">
              Forgot password?
            </Link>
          </p>
        </Form>
      </Card>
    </div>
  );
}
