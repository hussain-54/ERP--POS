import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { enterpriseApi } from "./enterprise-api";

export function HrPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
  const [code, setCode] = useState("EMP-01");
  const [fullName, setFullName] = useState("");
  const [isSalesman, setIsSalesman] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState("2.5");
  const [baseSalary, setBaseSalary] = useState("50000");
  const [employeeId, setEmployeeId] = useState("");
  const [periodYm, setPeriodYm] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceStatus, setAttendanceStatus] = useState("present");
  const [commissionView, setCommissionView] = useState<unknown>(null);
  const [salaries, setSalaries] = useState<Array<Record<string, unknown>>>([]);

  async function reload() {
    const [e, s] = await Promise.all([
      enterpriseApi.listEmployees(),
      enterpriseApi.listSalaries(),
    ]);
    setEmployees(e.items);
    setSalaries(s.items);
  }

  useEffect(() => {
    void reload().catch((err) =>
      toast.push({
        title: "HR load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">HR & employees</h1>
      <p className="text-sm opacity-70">
        Employees, attendance, salary, commission (linked to POS sales), incentives, and performance.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Employees">
          <div className="grid gap-2">
            <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input
              label="Base salary"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
            />
            <Input
              label="Commission %"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSalesman}
                onChange={(e) => setIsSalesman(e.target.checked)}
              />
              Salesman (commission from sales)
            </label>
            <Button
              type="button"
              onClick={() =>
                void enterpriseApi
                  .createEmployee({
                    code,
                    fullName,
                    baseSalary,
                    commissionPercent: Number(commissionPercent),
                    isSalesman,
                  })
                  .then(() => reload())
                  .then(() => toast.push({ title: "Employee created", tone: "success" }))
                  .catch((err) =>
                    toast.push({
                      title: "Failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Create employee
            </Button>
          </div>
          <ul className="mt-3 max-h-48 overflow-auto text-sm">
            {employees.map((e) => (
              <li key={String(e.id)}>
                <button type="button" className="underline" onClick={() => setEmployeeId(String(e.id))}>
                  {String(e.code)} — {String(e.full_name)}
                </button>
                {e.is_salesman ? ` · salesman ${String(e.commission_percent)}%` : ""}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Attendance">
          <Input
            label="Employee id"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span className="opacity-70">Status</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={attendanceStatus}
              onChange={(e) => setAttendanceStatus(e.target.value)}
            >
              {["present", "absent", "leave", "half_day"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="mt-2"
            type="button"
            onClick={() =>
              void enterpriseApi
                .upsertAttendance({
                  employeeId,
                  workDate: new Date().toISOString().slice(0, 10),
                  status: attendanceStatus,
                })
                .then(() => toast.push({ title: "Attendance saved", tone: "success" }))
            }
          >
            Mark today
          </Button>
        </Card>
      </div>

      <Card title="Salary + incentives + performance">
        <div className="grid gap-2 md:grid-cols-3">
          <Input label="Period YYYY-MM" value={periodYm} onChange={(e) => setPeriodYm(e.target.value)} />
          <Input
            label="Employee id"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void enterpriseApi
                .createSalary({
                  employeeId,
                  periodYm,
                  baseSalary: Number(baseSalary),
                  commissionAmount: 0,
                  incentiveAmount: 0,
                  deductions: 0,
                })
                .then(() => reload())
                .then(() => toast.push({ title: "Salary run posted", tone: "success" }))
            }
          >
            Post salary run
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void enterpriseApi
                .createIncentive({
                  employeeId,
                  title: "Monthly incentive",
                  amount: 1000,
                  periodYm,
                })
                .then(() => toast.push({ title: "Incentive added", tone: "success" }))
            }
          >
            Add incentive
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void enterpriseApi
                .upsertPerformance({
                  employeeId,
                  periodYm,
                  score: 80,
                  salesAmount: 100000,
                  targetAmount: 120000,
                })
                .then(() => toast.push({ title: "Performance saved", tone: "success" }))
            }
          >
            Save performance
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void enterpriseApi
                .commissions(
                  `?employeeId=${encodeURIComponent(employeeId)}&periodYm=${encodeURIComponent(periodYm)}`,
                )
                .then(setCommissionView)
            }
          >
            Load sales commissions
          </Button>
        </div>
        <pre className="mt-3 max-h-40 overflow-auto text-xs">
          {commissionView
            ? JSON.stringify(commissionView, null, 2)
            : "Salesman commissions from POS sale_commissions appear here."}
        </pre>
        <ul className="mt-2 text-sm">
          {salaries.map((s) => (
            <li key={String(s.id)}>
              {String(s.period_ym)} · emp {String(s.employee_id).slice(0, 8)} · net {String(s.net_amount)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
