import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, ConfirmationDialog, Dropdown, Select } from "@electronic-erp/ui";
import { Breadcrumbs } from "@/app/shell/Breadcrumbs";
import { UserAvatar } from "@/features/auth/UserAvatar";
import { profileApi } from "@/features/auth/profile-api";

export function GlobalHeader({
  compact,
  moduleTitle,
  pageTitle,
  mobileOpen,
  onOpenMobileNav,
  onOpenSearch,
  branchId,
  branches,
  onBranchChange,
  userName,
  userEmail,
  userAvatarUrl,
  showAudit,
  onLogout,
}: {
  compact?: boolean;
  moduleTitle: string;
  pageTitle: string | null;
  mobileOpen: boolean;
  onOpenMobileNav: () => void;
  onOpenSearch: () => void;
  branchId: string | null;
  branches: string[];
  onBranchChange: (id: string) => void;
  userName: string;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
  showAudit: boolean;
  onLogout: () => Promise<void> | void;
}) {
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [roleLabel, setRoleLabel] = useState<string>("User");

  useEffect(() => {
    let cancelled = false;
    void profileApi
      .me()
      .then((me) => {
        if (cancelled) return;
        const roles = me.roleNames?.filter(Boolean) ?? [];
        setRoleLabel(roles.length ? roles.join(", ") : "User");
      })
      .catch(() => {
        if (!cancelled) setRoleLabel("User");
      });
    return () => {
      cancelled = true;
    };
  }, [userEmail, userName]);

  async function confirmLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  return (
    <header
      data-erp-chrome="header"
      className={`sticky top-0 z-20 flex min-h-14 min-w-0 items-center gap-1.5 border-b border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-1.5 md:gap-2 md:overflow-x-hidden md:px-5 md:py-2 ${
        compact ? "flex-nowrap overflow-x-auto overscroll-x-contain" : "flex-wrap md:flex-nowrap"
      }`}
    >
      <Button
        id="erp-nav-menu"
        className="min-h-11 min-w-11 shrink-0 md:hidden"
        variant="secondary"
        size="sm"
        aria-expanded={mobileOpen}
        aria-controls="erp-module-nav"
        onClick={onOpenMobileNav}
      >
        Menu
      </Button>
      <Breadcrumbs moduleTitle={moduleTitle} pageTitle={pageTitle} />
      <button
        type="button"
        className="hidden min-h-11 min-w-[180px] items-center justify-between rounded-lg border border-[var(--erp-border)] bg-[var(--erp-bg)] px-3 text-left text-sm text-[var(--erp-muted)] hover:border-[var(--erp-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:border-[var(--erp-brand)] md:flex lg:h-9 lg:min-h-9"
        onClick={onOpenSearch}
      >
        <span>Search modules…</span>
        <kbd className="hidden rounded border border-[var(--erp-border)] bg-white px-1.5 text-[10px] text-[var(--erp-muted)] lg:inline">
          Ctrl K
        </kbd>
      </button>
      <Button className="min-h-11 shrink-0 md:hidden" variant="secondary" size="sm" onClick={onOpenSearch}>
        Search
      </Button>
      <div className="w-[6.75rem] shrink-0 sm:w-[9.5rem]">
        <Select
          aria-label="Branch"
          className="min-h-11 lg:min-h-9 lg:h-9"
          value={branchId ?? ""}
          onChange={(e) => onBranchChange(e.target.value)}
          options={
            branches.length
              ? branches.map((id) => ({ value: id, label: `Branch ${id.slice(0, 8)}` }))
              : [{ value: "", label: "No branches" }]
          }
        />
      </div>
      <Link
        to="/notifications"
        aria-label="Notifications"
        className="inline-flex h-11 min-h-11 shrink-0 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:bg-[var(--erp-bg)] lg:h-9 lg:min-h-9"
      >
        <span className="md:hidden">Alerts</span>
        <span className="hidden md:inline">Notifications</span>
      </Link>
      {showAudit ? (
        <Link
          to="/audit"
          className="hidden h-11 min-h-11 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:bg-[var(--erp-bg)] sm:inline-flex lg:h-9 lg:min-h-9"
        >
          Audit
        </Link>
      ) : null}

      <Dropdown
        align="right"
        menuClassName="min-w-[16rem]"
        trigger={
          <button
            type="button"
            aria-label="User"
            className="inline-flex min-h-11 max-w-[12rem] items-center gap-2 rounded-lg border border-[var(--erp-border)] bg-white px-2 py-1 text-left hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] lg:min-h-9"
          >
            <UserAvatar name={userName} email={userEmail} avatarUrl={userAvatarUrl} size="sm" />
            <span className="hidden min-w-0 truncate text-sm font-medium text-[var(--erp-ink)] sm:inline">
              {userName}
            </span>
          </button>
        }
        header={
          <div className="flex items-start gap-2.5">
            <UserAvatar name={userName} email={userEmail} avatarUrl={userAvatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--erp-ink)]">{userName}</p>
              <p className="truncate text-xs text-[var(--erp-muted)]">{roleLabel}</p>
              {userEmail ? (
                <p className="mt-0.5 truncate text-xs text-[var(--erp-muted)]">{userEmail}</p>
              ) : null}
            </div>
          </div>
        }
        items={[
          {
            id: "profile",
            label: "Profile",
            onSelect: () => navigate("/profile"),
          },
          {
            id: "account",
            label: "Account Settings",
            onSelect: () => navigate("/profile"),
          },
          {
            id: "password",
            label: "Change Password",
            onSelect: () => navigate("/profile?section=password"),
          },
          {
            id: "notifications",
            label: "Notifications",
            onSelect: () => navigate("/notifications"),
          },
          {
            id: "logout",
            label: "Logout",
            danger: true,
            onSelect: () => setLogoutOpen(true),
          },
        ]}
      />

      <ConfirmationDialog
        open={logoutOpen}
        title="Sign out?"
        description="You will be signed out of ERP System on this device. Unsaved work on this page may be lost."
        confirmLabel="Logout"
        cancelLabel="Stay signed in"
        danger
        loading={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={() => void confirmLogout()}
      />
    </header>
  );
}
