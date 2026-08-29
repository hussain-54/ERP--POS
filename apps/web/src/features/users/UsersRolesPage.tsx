import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  ConfirmationDialog,
  Form,
  FormActions,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  useToast,
} from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { UserAvatar } from "@/features/auth/UserAvatar";
import { adminApi } from "./admin-api";

const SYSTEM_ROLES_LIST = [
  { code: "super_admin", label: "Super Admin", desc: "Full unrestricted platform access" },
  { code: "owner", label: "Owner", desc: "Organization owner with enterprise governance" },
  { code: "admin", label: "Administrator", desc: "Operational administration & user control" },
  { code: "manager", label: "Manager", desc: "Branch oversight, sales, and approvals" },
  { code: "cashier", label: "Cashier", desc: "POS checkout, cash drawer, and shift billing" },
  { code: "salesman", label: "Salesman", desc: "Customer orders, quotations, and commissions" },
  { code: "storekeeper", label: "Storekeeper", desc: "Inventory receiving, bin locations, and dispatch" },
  { code: "warehouse_manager", label: "Warehouse Manager", desc: "Transfers, batch/serial tracking, audits" },
  { code: "accountant", label: "Accountant", desc: "General ledger, vouchers, banking, expenses" },
  { code: "delivery_boy", label: "Delivery Boy", desc: "Shipment dispatch, tracking, and proof of delivery" },
  { code: "technician", label: "Technician", desc: "Service repairs, diagnostic tests, warranties" },
  { code: "marketing_manager", label: "Marketing Manager", desc: "Discounts, CRM campaigns, and loyalty points" },
];

interface UserDetailedRecord {
  id: string;
  auth_user_id: string;
  organization_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  default_branch?: { id: string; name: string; code: string } | null;
  roles?: Array<{
    id: string;
    role_id: string;
    branch_id: string | null;
    roles?: { id: string; code: string; name: string } | null;
  }>;
  branches?: Array<{
    id: string;
    branch_id: string;
    branches?: { id: string; name: string; code: string } | null;
  }>;
}

export function UsersRolesPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [branches, setBranches] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<UserDetailedRecord[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modals state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [branchAccessOpen, setBranchAccessOpen] = useState(false);
  const [confirmToggleActiveOpen, setConfirmToggleActiveOpen] = useState(false);

  // Selected User for actions
  const [selectedUser, setSelectedUser] = useState<UserDetailedRecord | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    roleCode: "cashier",
    branchId: "",
    isActive: true,
  });

  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    defaultBranchId: "",
    isActive: true,
  });

  const [roleForm, setRoleForm] = useState({
    roleCode: "cashier",
    branchId: "",
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [userBranchIds, setUserBranchIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [r, b, u] = await Promise.all([
        adminApi.listRoles().catch(() => ({ items: [] })),
        adminApi.listBranches().catch(() => ({ items: [] })),
        adminApi.listDetailedUsers().catch(() => adminApi.listUsers()),
      ]);

      setRoles(r.items ?? []);
      setBranches(b.items ?? []);
      setUsers((u.items ?? []) as unknown as UserDetailedRecord[]);
    } catch (err) {
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error loading users and roles",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchQuery =
        !searchQuery ||
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(u.phone && u.phone.includes(searchQuery));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.is_active) ||
        (statusFilter === "inactive" && !u.is_active);

      const userRoleCodes = (u.roles ?? []).map((r) => r.roles?.code ?? "");
      const matchRole =
        roleFilter === "all" || userRoleCodes.includes(roleFilter);

      return matchQuery && matchStatus && matchRole;
    });
  }, [users, searchQuery, statusFilter, roleFilter]);

  async function onSeedRoles() {
    try {
      setSubmitting(true);
      await adminApi.seedRoles();
      toast.push({ title: "System roles initialized", tone: "success" });
      await loadData();
    } catch (err) {
      toast.push({
        title: "Seed failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password) {
      toast.push({ title: "Validation Error", description: "Name, email, and password are required", tone: "info" });
      return;
    }
    if (createForm.password.length < 8) {
      toast.push({ title: "Weak password", description: "Password must be at least 8 characters", tone: "info" });
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.createUser({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || undefined,
        password: createForm.password,
        roleCode: createForm.roleCode || undefined,
        branchId: createForm.branchId || undefined,
        isActive: createForm.isActive,
      });

      toast.push({ title: "User created successfully", tone: "success" });
      setCreateUserOpen(false);
      setCreateForm({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        roleCode: "cashier",
        branchId: "",
        isActive: true,
      });
      await loadData();
    } catch (err) {
      toast.push({
        title: "Failed to create user",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await adminApi.updateUser(selectedUser.id, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim() || null,
        defaultBranchId: editForm.defaultBranchId || null,
        isActive: editForm.isActive,
      });

      toast.push({ title: "User updated", tone: "success" });
      setEditUserOpen(false);
      await loadData();
    } catch (err) {
      toast.push({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignRole(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await adminApi.assignRole({
        userId: selectedUser.id,
        roleCode: roleForm.roleCode,
        branchId: roleForm.branchId || undefined,
      });

      toast.push({ title: "Role assigned successfully", tone: "success" });
      setAssignRoleOpen(false);
      await loadData();
    } catch (err) {
      toast.push({
        title: "Role assignment failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveRole(userRoleId: string) {
    try {
      await adminApi.removeUserRole(userRoleId);
      toast.push({ title: "Role removed", tone: "success" });
      await loadData();
    } catch (err) {
      toast.push({
        title: "Removal failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPasswordForm.newPassword.length < 8) {
      toast.push({ title: "Password too short", description: "Min 8 characters required", tone: "info" });
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      toast.push({ title: "Mismatch", description: "Passwords do not match", tone: "info" });
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.resetUserPassword(selectedUser.id, resetPasswordForm.newPassword);
      toast.push({ title: "Password updated successfully", tone: "success" });
      setResetPasswordOpen(false);
      setResetPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.push({
        title: "Password reset failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleBranchAccess(branchId: string, assigned: boolean) {
    if (!selectedUser) return;
    try {
      await adminApi.setMembership({
        userId: selectedUser.id,
        branchId,
        assign: assigned,
      });

      setUserBranchIds((prev) =>
        assigned ? [...prev, branchId] : prev.filter((id) => id !== branchId),
      );
      toast.push({
        title: assigned ? "Branch access granted" : "Branch access revoked",
        tone: "success",
      });
      await loadData();
    } catch (err) {
      toast.push({
        title: "Branch update failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function handleConfirmToggleActive() {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const nextStatus = !selectedUser.is_active;
      await adminApi.updateUser(selectedUser.id, { isActive: nextStatus });
      toast.push({
        title: nextStatus ? "User activated" : "User deactivated",
        tone: "success",
      });
      setConfirmToggleActiveOpen(false);
      await loadData();
    } catch (err) {
      toast.push({
        title: "Status change failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(u: UserDetailedRecord) {
    setSelectedUser(u);
    setEditForm({
      fullName: u.full_name,
      phone: u.phone ?? "",
      defaultBranchId: u.default_branch?.id ?? "",
      isActive: u.is_active,
    });
    setEditUserOpen(true);
  }

  function openRoleModal(u: UserDetailedRecord) {
    setSelectedUser(u);
    const existingCode = u.roles?.[0]?.roles?.code ?? "cashier";
    setRoleForm({
      roleCode: existingCode,
      branchId: u.roles?.[0]?.branch_id ?? "",
    });
    setAssignRoleOpen(true);
  }

  function openBranchModal(u: UserDetailedRecord) {
    setSelectedUser(u);
    const bIds = (u.branches ?? []).map((b) => String(b.branch_id));
    setUserBranchIds(bIds);
    setBranchAccessOpen(true);
  }

  function openResetPasswordModal(u: UserDetailedRecord) {
    setSelectedUser(u);
    setResetPasswordForm({ newPassword: "", confirmPassword: "" });
    setResetPasswordOpen(true);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "System Administration", href: "/settings" },
          { label: "Users & Roles" },
        ]}
      />

      <PageHeader
        title="User & Access Management"
        description="Govern team members, role assignments, security permissions, and multi-branch authorizations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onSeedRoles()}
              disabled={submitting}
            >
              <i className="fa-solid fa-arrows-rotate mr-1.5 text-xs text-slate-500" aria-hidden />
              Sync 12 System Roles
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setCreateUserOpen(true)}
            >
              <i className="fa-solid fa-user-plus mr-1.5 text-xs" aria-hidden />
              Create New User
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[var(--erp-border)]">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "border-[var(--erp-brand)] text-[var(--erp-brand)] font-semibold"
              : "border-transparent text-[var(--erp-muted)] hover:text-[var(--erp-ink)]"
          }`}
        >
          <i className="fa-solid fa-users text-xs" aria-hidden />
          <span>Users Directory</span>
          <Badge tone={users.length > 0 ? "brand" : "neutral"}>
            {users.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "roles"
              ? "border-[var(--erp-brand)] text-[var(--erp-brand)] font-semibold"
              : "border-transparent text-[var(--erp-muted)] hover:text-[var(--erp-ink)]"
          }`}
        >
          <i className="fa-solid fa-shield-halved text-xs" aria-hidden />
          <span>System Roles & Permissions</span>
          <Badge tone="neutral">
            {roles.length || 12}
          </Badge>
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="py-12">
            <LoadingState label="Loading users and access privileges…" />
          </div>
        </Card>
      ) : activeTab === "users" ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Input
                  placeholder="Search by name, email, or phone…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  options={[
                    { value: "all", label: "All Roles" },
                    ...SYSTEM_ROLES_LIST.map((r) => ({ value: r.code, label: r.label })),
                  ]}
                />
              </div>

              <div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "active", label: "Active Only" },
                    { value: "inactive", label: "Inactive Only" },
                  ]}
                />
              </div>

              <div className="flex items-center justify-end text-xs text-[var(--erp-muted)]">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>
          </Card>

          {/* Desktop Users Table */}
          <div className="hidden lg:block overflow-hidden rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-sm">
            <table className="w-full text-left text-sm text-[var(--erp-ink)]">
              <thead className="border-b border-[var(--erp-border)] bg-[var(--erp-bg)] text-xs font-semibold text-[var(--erp-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-4 py-3.5">Phone</th>
                  <th className="px-4 py-3.5">Assigned Roles</th>
                  <th className="px-4 py-3.5">Branch Access</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--erp-border)]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--erp-muted)]">
                      No users match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-[var(--erp-bg)]/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              avatarUrl={u.avatar_url}
                              name={u.full_name}
                              email={u.email}
                              size="md"
                            />
                            <div>
                              <div className="font-semibold text-[var(--erp-ink)] flex items-center gap-1.5">
                                <span>{u.full_name}</span>
                                {isSelf ? (
                                  <Badge tone="brand">You</Badge>
                                ) : null}
                              </div>
                              <div className="text-xs text-[var(--erp-muted)]">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs text-[var(--erp-muted)]">
                          {u.phone || "—"}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.roles && u.roles.length > 0 ? (
                              u.roles.map((r) => (
                                <span
                                  key={r.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                  {r.roles?.name ?? r.roles?.code ?? "Role"}
                                  {!isSelf ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveRole(r.id)}
                                      className="ml-1 text-blue-400 hover:text-blue-600"
                                      title="Remove role"
                                    >
                                      &times;
                                    </button>
                                  ) : null}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-amber-600 dark:text-amber-400">No role assigned</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs">
                          {u.branches && u.branches.length > 0 ? (
                            <span className="font-medium text-[var(--erp-ink)]">
                              {u.branches.map((b) => b.branches?.name ?? "Branch").join(", ")}
                            </span>
                          ) : u.default_branch ? (
                            <span className="text-[var(--erp-muted)]">{u.default_branch.name}</span>
                          ) : (
                            <span className="text-slate-400">All / Default</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <Badge tone={u.is_active ? "success" : "danger"}>
                            {u.is_active ? "Active" : "Deactivated"}
                          </Badge>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openRoleModal(u)}
                              title="Assign Role"
                            >
                              <i className="fa-solid fa-shield-halved text-xs text-blue-600 mr-1" aria-hidden />
                              Role
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openBranchModal(u)}
                              title="Branch Access"
                            >
                              <i className="fa-solid fa-building text-xs text-indigo-600 mr-1" aria-hidden />
                              Branches
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              title="Edit User"
                            >
                              <i className="fa-solid fa-pen text-xs text-slate-500 mr-1" aria-hidden />
                              Edit
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openResetPasswordModal(u)}
                              title="Reset Password"
                            >
                              <i className="fa-solid fa-key text-xs text-amber-600" aria-hidden />
                            </Button>

                            {!isSelf ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setConfirmToggleActiveOpen(true);
                                }}
                                title={u.is_active ? "Deactivate User" : "Activate User"}
                              >
                                <i
                                  className={`fa-solid ${
                                    u.is_active ? "fa-user-slash text-rose-500" : "fa-user-check text-emerald-600"
                                  } text-xs`}
                                  aria-hidden
                                />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Users Cards List (No Horizontal Overflow) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredUsers.length === 0 ? (
              <Card>
                <div className="py-8 text-center text-sm text-[var(--erp-muted)]">
                  No users found matching your criteria.
                </div>
              </Card>
            ) : (
              filteredUsers.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <Card key={u.id}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            avatarUrl={u.avatar_url}
                            name={u.full_name}
                            email={u.email}
                            size="md"
                          />
                          <div>
                            <div className="font-semibold text-sm text-[var(--erp-ink)] flex items-center gap-1.5">
                              <span>{u.full_name}</span>
                              {isSelf ? <Badge tone="brand">You</Badge> : null}
                            </div>
                            <div className="text-xs text-[var(--erp-muted)]">{u.email}</div>
                          </div>
                        </div>
                        <Badge tone={u.is_active ? "success" : "danger"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-y border-[var(--erp-border)] py-2">
                        <div>
                          <span className="text-[var(--erp-muted)] block">Roles:</span>
                          <span className="font-medium text-[var(--erp-ink)]">
                            {u.roles && u.roles.length > 0
                              ? u.roles.map((r) => r.roles?.name ?? r.roles?.code).join(", ")
                              : "None"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--erp-muted)] block">Branches:</span>
                          <span className="font-medium text-[var(--erp-ink)]">
                            {u.branches && u.branches.length > 0
                              ? u.branches.map((b) => b.branches?.name).join(", ")
                              : u.default_branch?.name ?? "Default"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={() => openRoleModal(u)}
                        >
                          Role
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={() => openBranchModal(u)}
                        >
                          Branches
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="flex-1 min-w-[80px]"
                          onClick={() => openEditModal(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openResetPasswordModal(u)}
                        >
                          <i className="fa-solid fa-key text-xs text-amber-600" aria-hidden />
                        </Button>
                        {!isSelf ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setConfirmToggleActiveOpen(true);
                            }}
                          >
                            <i
                              className={`fa-solid ${
                                u.is_active ? "fa-user-slash text-rose-500" : "fa-user-check text-emerald-600"
                              } text-xs`}
                              aria-hidden
                            />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Roles & Permissions Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_ROLES_LIST.map((r) => {
              const count = users.filter((u) =>
                (u.roles ?? []).some((ur) => ur.roles?.code === r.code),
              ).length;

              return (
                <Card key={r.code}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[var(--erp-ink)]">{r.label}</span>
                      <Badge tone="brand">System</Badge>
                    </div>
                    <p className="text-xs text-[var(--erp-muted)] leading-relaxed">{r.desc}</p>
                    <div className="pt-2 flex items-center justify-between border-t border-[var(--erp-border)] text-xs text-[var(--erp-muted)]">
                      <span>Assigned Users:</span>
                      <span className="font-semibold text-[var(--erp-ink)]">{count} users</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      <Modal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title="Create New User"
      >
        <Form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name *"
            value={createForm.fullName}
            onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
            placeholder="e.g. Tariq Mehmood"
            required
          />

          <Input
            label="Email Address *"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="tariq@company.com"
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Phone Number"
              type="tel"
              value={createForm.phone}
              onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+92 300 1234567"
            />

            <Input
              label="Initial Password *"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Min 8 chars"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Initial Role"
              value={createForm.roleCode}
              onChange={(e) => setCreateForm((p) => ({ ...p, roleCode: e.target.value }))}
              options={SYSTEM_ROLES_LIST.map((r) => ({ value: r.code, label: r.label }))}
            />

            <Select
              label="Default Branch"
              value={createForm.branchId}
              onChange={(e) => setCreateForm((p) => ({ ...p, branchId: e.target.value }))}
              options={[
                { value: "", label: "Default / All" },
                ...branches.map((b) => ({ value: String(b.id), label: String(b.name ?? b.code) })),
              ]}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={createForm.isActive}
              onChange={(e) => setCreateForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[var(--erp-brand)] focus:ring-[var(--erp-ring)]"
            />
            <span className="text-sm font-medium text-[var(--erp-ink)]">Activate account immediately</span>
          </label>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setCreateUserOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create User"}
            </Button>
          </FormActions>
        </Form>
      </Modal>

      {/* Modal: Edit User */}
      <Modal
        open={editUserOpen}
        onClose={() => setEditUserOpen(false)}
        title={`Edit User: ${selectedUser?.full_name ?? ""}`}
      >
        <Form onSubmit={handleEditUser} className="space-y-4">
          <Input
            label="Full Name *"
            value={editForm.fullName}
            onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
            required
          />

          <Input
            label="Phone Number"
            type="tel"
            value={editForm.phone}
            onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
          />

          <Select
            label="Default Branch"
            value={editForm.defaultBranchId}
            onChange={(e) => setEditForm((p) => ({ ...p, defaultBranchId: e.target.value }))}
            options={[
              { value: "", label: "None / Multi-branch" },
              ...branches.map((b) => ({ value: String(b.id), label: String(b.name ?? b.code) })),
            ]}
          />

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[var(--erp-brand)] focus:ring-[var(--erp-ring)]"
            />
            <span className="text-sm font-medium text-[var(--erp-ink)]">Account Active</span>
          </label>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setEditUserOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </FormActions>
        </Form>
      </Modal>

      {/* Modal: Assign Role */}
      <Modal
        open={assignRoleOpen}
        onClose={() => setAssignRoleOpen(false)}
        title={`Assign Role: ${selectedUser?.full_name ?? ""}`}
      >
        <Form onSubmit={handleAssignRole} className="space-y-4">
          <p className="text-xs text-[var(--erp-muted)]">
            Assigning a role grants all associated module and action permissions immediately.
          </p>

          <Select
            label="Select Role *"
            value={roleForm.roleCode}
            onChange={(e) => setRoleForm((p) => ({ ...p, roleCode: e.target.value }))}
            options={SYSTEM_ROLES_LIST.map((r) => ({
              value: r.code,
              label: `${r.label} — ${r.desc}`,
            }))}
          />

          <Select
            label="Scope to Branch (Optional)"
            value={roleForm.branchId}
            onChange={(e) => setRoleForm((p) => ({ ...p, branchId: e.target.value }))}
            options={[
              { value: "", label: "All Assigned Branches (Global Organization Role)" },
              ...branches.map((b) => ({ value: String(b.id), label: String(b.name ?? b.code) })),
            ]}
          />

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setAssignRoleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Assigning…" : "Save Role Assignment"}
            </Button>
          </FormActions>
        </Form>
      </Modal>

      {/* Modal: Branch Access */}
      <Modal
        open={branchAccessOpen}
        onClose={() => setBranchAccessOpen(false)}
        title={`Branch Access: ${selectedUser?.full_name ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--erp-muted)]">
            Users will only see and process sales, inventory, and records for their authorized branches.
          </p>

          <div className="divide-y divide-[var(--erp-border)] rounded-md border border-[var(--erp-border)] p-2">
            {branches.length === 0 ? (
              <p className="p-3 text-xs text-[var(--erp-muted)]">No branches found. Create branches in Branch Management.</p>
            ) : (
              branches.map((b) => {
                const bId = String(b.id);
                const assigned = userBranchIds.includes(bId);

                return (
                  <label key={bId} className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-[var(--erp-bg)] rounded">
                    <div>
                      <span className="text-sm font-semibold text-[var(--erp-ink)] block">{String(b.name)}</span>
                      <span className="text-xs text-[var(--erp-muted)]">Code: {String(b.code)}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={(e) => void handleToggleBranchAccess(bId, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--erp-brand)] focus:ring-[var(--erp-ring)]"
                    />
                  </label>
                );
              })
            )}
          </div>

          <FormActions>
            <Button type="button" variant="primary" onClick={() => setBranchAccessOpen(false)}>
              Done
            </Button>
          </FormActions>
        </div>
      </Modal>

      {/* Modal: Reset Password */}
      <Modal
        open={resetPasswordOpen}
        onClose={() => setResetPasswordOpen(false)}
        title={`Reset Password: ${selectedUser?.full_name ?? ""}`}
      >
        <Form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-[var(--erp-muted)]">
            Set a new secure temporary or permanent password for this user.
          </p>

          <Input
            label="New Password *"
            type="password"
            value={resetPasswordForm.newPassword}
            onChange={(e) => setResetPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
            placeholder="Min 8 characters"
            required
          />

          <Input
            label="Confirm Password *"
            type="password"
            value={resetPasswordForm.confirmPassword}
            onChange={(e) => setResetPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            placeholder="Repeat password"
            required
          />

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => setResetPasswordOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Resetting…" : "Reset Password"}
            </Button>
          </FormActions>
        </Form>
      </Modal>

      {/* Confirmation Dialog: Toggle Active */}
      <ConfirmationDialog
        open={confirmToggleActiveOpen}
        title={selectedUser?.is_active ? "Deactivate User Account?" : "Activate User Account?"}
        description={
          selectedUser?.is_active
            ? `Are you sure you want to deactivate ${selectedUser.full_name}? They will immediately lose login access across all branches.`
            : `Are you sure you want to activate ${selectedUser?.full_name}? They will regain login access immediately.`
        }
        confirmLabel={selectedUser?.is_active ? "Deactivate User" : "Activate User"}
        cancelLabel="Cancel"
        danger={selectedUser?.is_active}
        loading={submitting}
        onCancel={() => setConfirmToggleActiveOpen(false)}
        onConfirm={() => void handleConfirmToggleActive()}
      />
    </div>
  );
}
