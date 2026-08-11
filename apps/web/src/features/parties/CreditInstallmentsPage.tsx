import { useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { partiesApi } from "./parties-api";
import { useAuth } from "@/features/auth/AuthContext";

function uuid() {
  return crypto.randomUUID();
}

export function CreditInstallmentsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [credit, setCredit] = useState({
    customerId: "",
    requestedAmount: "5000",
    reason: "",
    approvalId: "",
  });
  const [plan, setPlan] = useState({
    customerId: "",
    totalAmount: "120000",
    downPayment: "20000",
    installmentCount: "4",
    startDate: new Date().toISOString().slice(0, 10),
    planId: "",
  });
  const [schedule, setSchedule] = useState<Array<Record<string, unknown>>>([]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Credit & Installments</h1>

      <Card title="Credit approval / reminders / block">
        <Form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void partiesApi
              .requestCreditApproval({
                customerId: credit.customerId,
                requestedAmount: credit.requestedAmount,
                reason: credit.reason || undefined,
              })
              .then((res) => {
                setCredit((p) => ({ ...p, approvalId: String((res as { id?: string }).id ?? "") }));
                toast.push({ title: "Credit approval requested", tone: "success" });
              })
              .catch((err: unknown) =>
                toast.push({
                  title: "Request failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Customer ID" required value={credit.customerId} onChange={(e) => setCredit((p) => ({ ...p, customerId: e.target.value }))} />
            <Input label="Requested credit amount" required value={credit.requestedAmount} onChange={(e) => setCredit((p) => ({ ...p, requestedAmount: e.target.value }))} />
            <Input label="Reason" value={credit.reason} onChange={(e) => setCredit((p) => ({ ...p, reason: e.target.value }))} />
            <Input label="Approval ID" value={credit.approvalId} onChange={(e) => setCredit((p) => ({ ...p, approvalId: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Request approval</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void partiesApi
                  .approveCredit(credit.approvalId)
                  .then(() => toast.push({ title: "Credit approved", tone: "success" }))
                  .catch((err: unknown) =>
                    toast.push({
                      title: "Approve failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                void partiesApi
                  .generateReminders()
                  .then((res) =>
                    toast.push({
                      title: "Reminders generated",
                      description: `${(res as { items?: unknown[] }).items?.length ?? 0} created`,
                      tone: "success",
                    }),
                  )
              }
            >
              Generate overdue reminders
            </Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Installment plan">
        <Form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!branchId) return;
            void partiesApi
              .createInstallmentPlan({
                branchId,
                customerId: plan.customerId,
                sourceType: "sale",
                sourceId: uuid(),
                totalAmount: plan.totalAmount,
                downPayment: plan.downPayment,
                installmentCount: Number(plan.installmentCount),
                startDate: plan.startDate,
              })
              .then(async (res) => {
                const planId = String((res as { plan?: { id?: string } }).plan?.id ?? "");
                setPlan((p) => ({ ...p, planId }));
                const sched = await partiesApi.installmentSchedule(planId);
                setSchedule(sched.items);
                toast.push({ title: "Installment schedule created", tone: "success" });
              })
              .catch((err: unknown) =>
                toast.push({
                  title: "Plan failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Customer ID" required value={plan.customerId} onChange={(e) => setPlan((p) => ({ ...p, customerId: e.target.value }))} />
            <Input label="Total" required value={plan.totalAmount} onChange={(e) => setPlan((p) => ({ ...p, totalAmount: e.target.value }))} />
            <Input label="Down payment" value={plan.downPayment} onChange={(e) => setPlan((p) => ({ ...p, downPayment: e.target.value }))} />
            <Input label="Number of installments" value={plan.installmentCount} onChange={(e) => setPlan((p) => ({ ...p, installmentCount: e.target.value }))} />
            <Input label="Start date" type="date" value={plan.startDate} onChange={(e) => setPlan((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Generate schedule</Button>
          </FormActions>
        </Form>
        <ul className="mt-4 space-y-1 text-sm">
          {schedule.map((s) => (
            <li key={String(s.id ?? s.sequence_no)}>
              #{String(s.sequence_no)} · due {String(s.due_date)} · {String(s.amount)} · {String(s.status)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
