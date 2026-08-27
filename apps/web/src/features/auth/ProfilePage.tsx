import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  ErrorState,
  Form,
  FormActions,
  Input,
  LoadingState,
  PageHeader,
  Select,
  useToast,
} from "@electronic-erp/ui";
import { DEFAULT_PASSWORD_POLICY, validatePasswordAgainstPolicy } from "@electronic-erp/domain";
import { useDocumentTitle } from "@/app/useDocumentTitle";
import { useAuth } from "@/features/auth/AuthContext";
import { profileApi, type OwnProfileResponse } from "@/features/auth/profile-api";
import { UserAvatar } from "@/features/auth/UserAvatar";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function ProfilePage() {
  useDocumentTitle("Profile");
  const toast = useToast();
  const { user, branchId, branches, setBranchId, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusPassword = searchParams.get("section") === "password";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<Pick<OwnProfileResponse, "roleNames" | "lastLoginAt" | "branchName">>({
    roleNames: [],
    lastLoginAt: null,
    branchName: null,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultBranchId, setDefaultBranchId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await profileApi.me();
      setExtras({
        roleNames: me.roleNames ?? [],
        lastLoginAt: me.lastLoginAt ?? null,
        branchName: me.branchName ?? null,
      });
      setFullName(me.user.fullName);
      setPhone(me.user.phone ?? "");
      setDefaultBranchId(me.user.defaultBranchId ?? branchId ?? "");
      setAvatarUrl(me.user.avatarUrl ?? "");
      await refreshUser(me.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [branchId, refreshUser]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusPassword) {
      document.getElementById("profile-change-password")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusPassword, loading]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { user: updated } = await profileApi.update({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        defaultBranchId: defaultBranchId || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      await refreshUser(updated);
      if (updated.defaultBranchId) setBranchId(updated.defaultBranchId);
      toast.push({ title: "Profile updated", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }
    const policyCheck = validatePasswordAgainstPolicy(newPassword, DEFAULT_PASSWORD_POLICY);
    if (!policyCheck.ok) {
      setPasswordError(policyCheck.errors.join(". "));
      return;
    }
    setChangingPassword(true);
    try {
      await profileApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.push({ title: "Password changed", tone: "success" });
      if (focusPassword) setSearchParams({}, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not change password";
      setPasswordError(message);
      toast.push({ title: "Password change failed", description: message, tone: "danger" });
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) return <LoadingState label="Loading profile…" />;
  if (error || !user) {
    return <ErrorState title="Profile unavailable" description={error ?? "Sign in again."} onRetry={() => void load()} />;
  }

  const roleLabel = extras.roleNames?.length ? extras.roleNames.join(", ") : "User";
  const statusTone = user.isActive ? "success" : "neutral";

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Profile" },
        ]}
      />
      <PageHeader
        title="Profile"
        description="Manage your account details, branch preference, and password."
        actions={
          <Link
            className="inline-flex h-10 items-center rounded-xl border border-[var(--erp-border)] px-4 text-sm font-medium hover:bg-[var(--erp-surface-muted)]"
            to="/notifications"
          >
            Notifications
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-[var(--erp-shadow)]">
        <UserAvatar name={user.fullName} email={user.email} avatarUrl={user.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-[var(--erp-ink)]">{user.fullName}</h2>
            <Badge tone={statusTone}>{user.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--erp-muted)]">{user.email}</p>
          <p className="mt-1 text-sm text-[var(--erp-muted)]">
            {roleLabel}
            {extras.branchName || branchId
              ? ` · ${extras.branchName ?? `Branch ${String(branchId).slice(0, 8)}`}`
              : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Account information">
          <dl className="space-y-0">
            <InfoRow label="Full name" value={user.fullName} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Phone" value={user.phone ?? "—"} />
            <InfoRow label="Role" value={roleLabel} />
            <InfoRow
              label="Branch"
              value={extras.branchName ?? (branchId ? `Branch ${branchId.slice(0, 8)}` : "—")}
            />
            <InfoRow label="Account status" value={user.isActive ? "Active" : "Inactive"} />
            <InfoRow label="Last login" value={formatDateTime(extras.lastLoginAt)} />
          </dl>
        </Card>

        <Card title="Account settings" description="Update editable profile fields.">
          <Form onSubmit={onSaveProfile} className="space-y-3">
            <Input
              label="Full name"
              value={fullName}
              required
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input label="Email" value={user.email} disabled />
            <Input
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
            <Select
              label="Default branch"
              value={defaultBranchId}
              onChange={(e) => setDefaultBranchId(e.target.value)}
              options={[
                { value: "", label: "No default" },
                ...branches.map((id) => ({
                  value: id,
                  label: id === branchId && extras.branchName ? extras.branchName : `Branch ${id.slice(0, 8)}`,
                })),
              ]}
            />
            <Input
              label="Avatar URL"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
            <FormActions>
              <Button type="submit" loading={saving} disabled={saving}>
                Save changes
              </Button>
            </FormActions>
          </Form>
        </Card>
      </div>

      <div id="profile-change-password">
        <Card
          title="Change password"
          description={`Password must be at least ${DEFAULT_PASSWORD_POLICY.minLength} characters with uppercase, lowercase, and a number.`}
        >
          <Form onSubmit={onChangePassword} className="mx-auto max-w-md space-y-3">
            {passwordError ? (
              <div
                role="alert"
                className="rounded-[var(--erp-radius)] border border-[var(--erp-danger)]/30 bg-[var(--erp-danger-soft)] px-3 py-2 text-sm text-[var(--erp-danger)]"
              >
                {passwordError}
              </div>
            ) : null}
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <FormActions>
              <Button type="submit" loading={changingPassword} disabled={changingPassword}>
                Update password
              </Button>
            </FormActions>
          </Form>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--erp-border)] py-2.5 last:border-0 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--erp-ink)]">{value}</dd>
    </div>
  );
}
