# Phase 9 — RBAC + Multi-branch + Approvals + Audit

## Roles

Seeded via `POST /api/v1/admin/roles/seed`:

Super Admin, Owner, Admin, Manager, Cashier, Salesman, Storekeeper, Warehouse Manager, Accountant, Delivery Boy, Technician, Marketing Manager.

Default permission matrices live in `packages/domain/src/rbac-catalog.ts`.

## Permissions

Modules support: view, add, edit, delete, approve, reject, print, export, import, cancel, refund.

Assigned by:

- **role** — `role_permissions`
- **user** — `user_permissions` (grant/deny)
- **branch** — optional `branch_id` on `user_roles` / `user_permissions`

Effective keys: role grants ∪ user grants − user denies (`get_user_permission_keys`).

## Approvals

Unified inbox `approval_requests` + `approval_actions`:

| Workflow | Chain |
|----------|--------|
| Discount | Cashier → Manager → Owner |
| Purchase | Storekeeper → Manager → Owner |
| Expense | Employee → Admin → Owner |
| Return | Cashier → Manager |
| Credit | Salesman → Manager → Owner |

Each action stores request, approver, timestamp, status, remarks, and linked audit row.

## Multi-branch

Branches (main flagged in `settings.is_main`), memberships, branch-scoped roles. Owner `dashboard.group_view` consolidates stock/sales/purchases/customers/expenses per branch.

## Audit

Append-only `audit_logs` (DB trigger blocks update/delete). Captures actor kind (creator/editor/deleter/approver/…), old/new JSON, IP/device when provided.

## API

`/api/v1/admin/*`

## Web

`/users`, `/permissions`, `/approvals`, `/audit`, `/branches`

## Verify

```bash
npm run build:packages
npm run test:phase9
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
