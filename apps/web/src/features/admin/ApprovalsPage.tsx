import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { adminApi } from "./admin-api";

export function ApprovalsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [actorRoles, setActorRoles] = useState("manager");
  const [form, setForm] = useState({
    workflowType: "discount",
    title: "",
    amount: "0",
    remarks: "",
    requesterRole: "cashier",
  });

  async function load() {
    const res = await adminApi.listApprovals();
    setItems(res.items);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await adminApi.createApproval({
        branchId: branchId ?? undefined,
        workflowType: form.workflowType,
        entityType: form.workflowType,
        title: form.title || `${form.workflowType} approval`,
        amount: Number(form.amount),
        remarks: form.remarks || undefined,
        requesterRole: form.requesterRole,
        payload: {},
      });
      toast.push({ title: "Approval requested", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Request failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    try {
      await adminApi.decideApproval(id, {
        decision,
        actorRoles: actorRoles.split(",").map((s) => s.trim()).filter(Boolean),
        remarks: `${decision} via inbox`,
      });
      toast.push({ title: `Marked ${decision}`, tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Decision failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Approval workflow</h1>

      <Card title="Submit request">
        <Form onSubmit={onCreate}>
          <Select
            label="Workflow"
            value={form.workflowType}
            onChange={(e) => setForm((p) => ({ ...p, workflowType: e.target.value }))}
            options={[
              { value: "discount", label: "Discount (Cashier→Manager→Owner)" },
              { value: "purchase", label: "Purchase (Storekeeper→Manager→Owner)" },
              { value: "expense", label: "Expense (Employee→Admin→Owner)" },
              { value: "return", label: "Return (Cashier→Manager)" },
              { value: "credit", label: "Credit (Salesman→Manager→Owner)" },
            ]}
          />
          <Input
            label="Requester role"
            value={form.requesterRole}
            onChange={(e) => setForm((p) => ({ ...p, requesterRole: e.target.value }))}
          />
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Input
            label="Amount"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          />
          <Input
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Submit</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Inbox">
        <Input
          label="Acting roles (comma-separated)"
          value={actorRoles}
          onChange={(e) => setActorRoles(e.target.value)}
        />
        <div className="mt-2 max-h-80 overflow-auto text-sm">
          {items.map((a) => (
            <div key={String(a.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <div>
                <div className="font-medium">{String(a.title)}</div>
                <div className="opacity-70">
                  {String(a.workflow_type)} · step {String(a.current_step)} · {String(a.status)}
                </div>
              </div>
              {a.status === "pending" && (
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void decide(String(a.id), "approve")}>
                    Approve
                  </Button>
                  <Button type="button" onClick={() => void decide(String(a.id), "reject")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
