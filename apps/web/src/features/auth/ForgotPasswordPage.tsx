import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Form, Input, useToast } from "@electronic-erp/ui";
import { authService } from "./auth-service";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(email);
      toast.push({
        title: "Reset email sent",
        description: "Check your inbox for the reset link.",
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Could not send reset email",
        description: err instanceof Error ? err.message : "Unknown error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card title="Reset password" description="We will email a secure reset link." className="w-full max-w-md">
        <Form onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link className="text-[var(--erp-brand)] underline" to="/login">
              Back to login
            </Link>
          </p>
        </Form>
      </Card>
    </div>
  );
}
