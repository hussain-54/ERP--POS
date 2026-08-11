import type {
  CreateAccountInput,
  CreateBankAccountInput,
  CreateExpenseInput,
  CreateReconciliationInput,
  CreateVoucherInput,
  ImportBankStatementInput,
  MatchBankLineInput,
} from "@electronic-erp/contracts";
import {
  assertJournalBalanced,
  buildCashBook,
  buildExpenseJournalLines,
  buildProfitAndLoss,
  buildTrialBalance,
  EXPENSE_CATEGORY_CODES,
  expenseReportByPeriod,
  STANDARD_COA,
  ValidationDomainError,
  voucherNeedsBalancedLines,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

export class AccountingRepository {
  constructor(private readonly db: DatabaseClient) {}

  async seedChartOfAccounts(organizationId: string) {
    for (const acc of STANDARD_COA) {
      await this.db.from("accounts").upsert(
        {
          organization_id: organizationId,
          code: acc.code,
          name: acc.name,
          account_type: acc.accountType,
          system_role: acc.systemRole,
          is_system: true,
          is_active: true,
          is_postable: true,
        },
        { onConflict: "organization_id,code" },
      );
    }
    for (const [key, code] of Object.entries(EXPENSE_CATEGORY_CODES)) {
      const { data: gl } = await this.db
        .from("accounts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("code", code)
        .maybeSingle();
      await this.db.from("expense_categories").upsert(
        {
          organization_id: organizationId,
          code: key.toUpperCase().slice(0, 12),
          name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          system_key: key,
          gl_account_id: gl?.id ?? null,
          is_active: true,
        },
        { onConflict: "organization_id,code" },
      );
    }
    return this.listAccounts(organizationId);
  }

  async createAccount(input: CreateAccountInput) {
    const { data, error } = await this.db
      .from("accounts")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        account_type: input.accountType,
        system_role: input.systemRole ?? null,
        parent_id: input.parentId ?? null,
        is_postable: input.isPostable ?? true,
        is_system: false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listAccounts(organizationId: string) {
    const { data, error } = await this.db
      .from("accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("code");
    if (error) throw error;
    return data ?? [];
  }

  async createVoucher(input: CreateVoucherInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("vouchers")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    voucherNeedsBalancedLines(input.lines);
    const resolved = await this.resolveVoucherLines(input.organizationId, input.lines);
    assertJournalBalanced(
      resolved.map((l) => ({
        code: l.code,
        name: l.name,
        accountType: l.accountType as "asset",
        debit: l.debit,
        credit: l.credit,
      })),
    );

    const total = resolved.reduce((s, l) => s + l.debit, 0);
    const voucherNumber = `VCH-${input.voucherType.toUpperCase().slice(0, 3)}-${Date.now()}`;
    const { data: voucher, error } = await this.db
      .from("vouchers")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        voucher_number: voucherNumber,
        voucher_type: input.voucherType,
        voucher_date: input.voucherDate ?? new Date().toISOString().slice(0, 10),
        memo: input.memo ?? null,
        party_type: input.partyType ?? null,
        customer_id: input.customerId ?? null,
        supplier_id: input.supplierId ?? null,
        status: "posted",
        total_amount: total,
        idempotency_key: input.idempotencyKey,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.db.from("voucher_lines").insert(
      resolved.map((l, i) => ({
        organization_id: input.organizationId,
        voucher_id: voucher.id,
        line_no: i + 1,
        account_id: l.accountId,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo ?? null,
      })),
    );

    const journal = await this.postJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: `voucher_${input.voucherType}`,
      sourceId: String(voucher.id),
      idempotencyKey: input.idempotencyKey,
      memo: input.memo ?? voucherNumber,
      entryDate: input.voucherDate,
      lines: resolved.map((l) => ({
        code: l.code,
        name: l.name,
        accountType: l.accountType,
        systemRole: l.systemRole,
        debit: l.debit,
        credit: l.credit,
      })),
    });

    await this.db
      .from("vouchers")
      .update({ journal_entry_id: journal.id, updated_at: new Date().toISOString() })
      .eq("id", voucher.id);

    return { ...voucher, journal_entry_id: journal.id };
  }

  async listVouchers(organizationId: string, voucherType?: string) {
    let q = this.db
      .from("vouchers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("voucher_date", { ascending: false })
      .limit(200);
    if (voucherType) q = q.eq("voucher_type", voucherType);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async createBankAccount(input: CreateBankAccountInput) {
    let glAccountId = input.glAccountId;
    if (!glAccountId) {
      const code =
        input.accountKind === "cash" ? "1000" : input.accountKind === "online" ? "1020" : "1010";
      const role = input.accountKind === "cash" ? "cash" : "bank";
      const { data: acc } = await this.db
        .from("accounts")
        .upsert(
          {
            organization_id: input.organizationId,
            code,
            name: input.accountKind === "cash" ? "Cash" : input.accountKind === "online" ? "Online Payments" : "Bank",
            account_type: "asset",
            system_role: role,
            is_system: true,
          },
          { onConflict: "organization_id,code" },
        )
        .select("id")
        .single();
      glAccountId = String(acc?.id);
    }

    const { data, error } = await this.db
      .from("bank_accounts")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        gl_account_id: glAccountId,
        account_kind: input.accountKind,
        name: input.name,
        bank_name: input.bankName ?? null,
        account_number: input.accountNumber ?? null,
        iban: input.iban ?? null,
        opening_balance: input.openingBalance ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listBankAccounts(organizationId: string) {
    const { data, error } = await this.db
      .from("bank_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  async importBankStatement(input: ImportBankStatementInput, userId?: string | null) {
    const { data: imp, error } = await this.db
      .from("bank_statement_imports")
      .insert({
        organization_id: input.organizationId,
        bank_account_id: input.bankAccountId,
        import_label: input.importLabel,
        row_count: input.lines.length,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const rows = input.lines.map((l) => ({
      organization_id: input.organizationId,
      bank_account_id: input.bankAccountId,
      import_id: imp.id,
      statement_date: l.statementDate,
      description: l.description ?? null,
      reference: l.reference ?? null,
      amount: l.amount,
      balance_after: l.balanceAfter ?? null,
      match_status: "unmatched",
    }));
    const { error: lineErr } = await this.db.from("bank_statement_lines").insert(rows);
    if (lineErr) throw lineErr;
    return imp;
  }

  async listStatementLines(organizationId: string, bankAccountId: string, status?: string) {
    let q = this.db
      .from("bank_statement_lines")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("bank_account_id", bankAccountId)
      .order("statement_date", { ascending: false })
      .limit(500);
    if (status) q = q.eq("match_status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async matchBankLine(input: MatchBankLineInput) {
    if (input.ignore) {
      const { data, error } = await this.db
        .from("bank_statement_lines")
        .update({ match_status: "ignored" })
        .eq("id", input.statementLineId)
        .eq("organization_id", input.organizationId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }
    if (!input.journalEntryId && !input.voucherId) {
      throw new ValidationDomainError("Provide journalEntryId or voucherId to match");
    }
    const { data, error } = await this.db
      .from("bank_statement_lines")
      .update({
        match_status: "matched",
        matched_journal_entry_id: input.journalEntryId ?? null,
        matched_voucher_id: input.voucherId ?? null,
      })
      .eq("id", input.statementLineId)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async createReconciliation(input: CreateReconciliationInput, userId?: string | null) {
    const bookBalance = await this.bankBookBalance(
      input.organizationId,
      input.bankAccountId,
      input.periodEnd,
    );
    const difference = Math.round((input.statementBalance - bookBalance) * 100) / 100;
    const { data, error } = await this.db
      .from("bank_reconciliations")
      .insert({
        organization_id: input.organizationId,
        bank_account_id: input.bankAccountId,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        statement_balance: input.statementBalance,
        book_balance: bookBalance,
        difference,
        status: Math.abs(difference) < 0.01 ? "completed" : "open",
        completed_at: Math.abs(difference) < 0.01 ? new Date().toISOString() : null,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async createExpense(input: CreateExpenseInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("expenses")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    let categoryId = input.categoryId;
    let expenseCode = "6000";
    let expenseName = "Expenses";
    if (!categoryId && input.categoryKey) {
      const code = input.categoryKey.toUpperCase().slice(0, 12);
      const { data: cat } = await this.db
        .from("expense_categories")
        .select("*")
        .eq("organization_id", input.organizationId)
        .eq("system_key", input.categoryKey)
        .maybeSingle();
      if (cat) {
        categoryId = String(cat.id);
        expenseCode = EXPENSE_CATEGORY_CODES[input.categoryKey] ?? "6000";
        expenseName = String(cat.name);
        if (cat.gl_account_id) {
          const { data: gl } = await this.db
            .from("accounts")
            .select("code,name")
            .eq("id", cat.gl_account_id)
            .maybeSingle();
          if (gl) {
            expenseCode = String(gl.code);
            expenseName = String(gl.name);
          }
        }
      } else {
        expenseCode = EXPENSE_CATEGORY_CODES[input.categoryKey] ?? "6000";
        const { data: created } = await this.db
          .from("expense_categories")
          .insert({
            organization_id: input.organizationId,
            code,
            name: input.categoryKey,
            system_key: input.categoryKey,
          })
          .select("*")
          .single();
        categoryId = String(created?.id);
      }
    }
    if (!categoryId) throw new ValidationDomainError("categoryId or categoryKey required");

    let payFromCode = "1000";
    if (input.paymentAccountId) {
      const { data: ba } = await this.db
        .from("bank_accounts")
        .select("account_kind")
        .eq("id", input.paymentAccountId)
        .maybeSingle();
      if (ba?.account_kind === "bank") payFromCode = "1010";
      if (ba?.account_kind === "online") payFromCode = "1020";
    }

    const lines = buildExpenseJournalLines({
      amount: input.amount,
      taxAmount: input.taxAmount ?? 0,
      expenseCode,
      expenseName,
      payFromCode,
    });

    const expenseNumber = `EXP-${Date.now()}`;
    const { data: expense, error } = await this.db
      .from("expenses")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        expense_number: expenseNumber,
        category_id: categoryId,
        expense_date: input.expenseDate ?? new Date().toISOString().slice(0, 10),
        amount: input.amount,
        tax_amount: input.taxAmount ?? 0,
        payment_account_id: input.paymentAccountId ?? null,
        payee: input.payee ?? null,
        notes: input.notes ?? null,
        status: "posted",
        idempotency_key: input.idempotencyKey,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const voucher = await this.createVoucher(
      {
        organizationId: input.organizationId,
        branchId: input.branchId,
        voucherType: "expense",
        voucherDate: input.expenseDate,
        memo: input.notes ?? `Expense ${expenseNumber}`,
        lines: lines.map((l) => ({
          accountCode: l.code,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo,
        })),
        idempotencyKey: input.idempotencyKey,
      },
      userId,
    );

    await this.db
      .from("expenses")
      .update({
        voucher_id: voucher.id,
        journal_entry_id: voucher.journal_entry_id,
      })
      .eq("id", expense.id);

    return { ...expense, voucher_id: voucher.id, journal_entry_id: voucher.journal_entry_id };
  }

  async listExpenses(organizationId: string) {
    const { data, error } = await this.db
      .from("expenses")
      .select("*, expense_categories(name,system_key)")
      .eq("organization_id", organizationId)
      .order("expense_date", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async listExpenseCategories(organizationId: string) {
    const { data, error } = await this.db
      .from("expense_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  async reportTrialBalance(organizationId: string, from?: string, to?: string) {
    const lines = await this.journalLinesWithAccounts(organizationId, from, to);
    return buildTrialBalance(lines);
  }

  async reportProfitAndLoss(organizationId: string, from?: string, to?: string) {
    const lines = await this.journalLinesWithAccounts(organizationId, from, to);
    return buildProfitAndLoss(lines);
  }

  async reportCashBook(organizationId: string, from?: string, to?: string) {
    return this.accountBook(organizationId, "1000", from, to);
  }

  async reportBankBook(
    organizationId: string,
    bankAccountId?: string,
    from?: string,
    to?: string,
  ) {
    if (bankAccountId) {
      const { data: ba } = await this.db
        .from("bank_accounts")
        .select("gl_account_id,opening_balance")
        .eq("id", bankAccountId)
        .maybeSingle();
      if (!ba) throw new ValidationDomainError("Bank account not found");
      const { data: gl } = await this.db
        .from("accounts")
        .select("code")
        .eq("id", ba.gl_account_id)
        .maybeSingle();
      return this.accountBook(
        organizationId,
        String(gl?.code ?? "1010"),
        from,
        to,
        Number(ba.opening_balance ?? 0),
      );
    }
    return this.accountBook(organizationId, "1010", from, to);
  }

  async reportReceivables(organizationId: string) {
    return this.partyBalances(organizationId, "customer");
  }

  async reportPayables(organizationId: string) {
    return this.partyBalances(organizationId, "supplier");
  }

  async reportCustomerLedger(organizationId: string, customerId: string) {
    const { data, error } = await this.db
      .from("party_ledger_entries")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("party_type", "customer")
      .eq("customer_id", customerId)
      .order("occurred_at");
    if (error) throw error;
    return data ?? [];
  }

  async reportSupplierLedger(organizationId: string, supplierId: string) {
    const { data, error } = await this.db
      .from("party_ledger_entries")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("party_type", "supplier")
      .eq("supplier_id", supplierId)
      .order("occurred_at");
    if (error) throw error;
    return data ?? [];
  }

  async reportExpenses(
    organizationId: string,
    period: "daily" | "monthly" | "yearly" = "monthly",
  ) {
    const expenses = await this.listExpenses(organizationId);
    const mapped = expenses.map((e: Row) => ({
      date: String(e.expense_date),
      amount: Number(e.amount),
      category:
        (e.expense_categories as { name?: string } | null)?.name ??
        String(e.category_id),
    }));
    return expenseReportByPeriod(mapped, period);
  }

  async listJournals(organizationId: string) {
    const { data, error } = await this.db
      .from("journal_entries")
      .select("*")
      .eq("organization_id", organizationId)
      .order("entry_date", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  // --- internals ---

  private async resolveVoucherLines(
    organizationId: string,
    lines: CreateVoucherInput["lines"],
  ) {
    const out: Array<{
      accountId: string;
      code: string;
      name: string;
      accountType: string;
      systemRole?: string;
      debit: number;
      credit: number;
      memo?: string;
    }> = [];
    for (const line of lines) {
      let accountId = line.accountId;
      let code = line.accountCode ?? "";
      let name = code;
      let accountType = "asset";
      let systemRole: string | undefined;
      if (accountId) {
        const { data: acc } = await this.db
          .from("accounts")
          .select("*")
          .eq("id", accountId)
          .maybeSingle();
        if (!acc) throw new ValidationDomainError(`Account ${accountId} not found`);
        code = String(acc.code);
        name = String(acc.name);
        accountType = String(acc.account_type);
        systemRole = acc.system_role ? String(acc.system_role) : undefined;
      } else if (line.accountCode) {
        const seed = STANDARD_COA.find((a) => a.code === line.accountCode);
        const { data: acc } = await this.db
          .from("accounts")
          .upsert(
            {
              organization_id: organizationId,
              code: line.accountCode,
              name: seed?.name ?? line.accountCode,
              account_type: seed?.accountType ?? "asset",
              system_role: seed?.systemRole ?? null,
              is_system: Boolean(seed),
            },
            { onConflict: "organization_id,code" },
          )
          .select("*")
          .single();
        accountId = String(acc?.id);
        code = String(acc?.code);
        name = String(acc?.name);
        accountType = String(acc?.account_type);
        systemRole = acc?.system_role ? String(acc.system_role) : undefined;
      } else {
        throw new ValidationDomainError("Each voucher line needs accountId or accountCode");
      }
      out.push({
        accountId: accountId!,
        code,
        name,
        accountType,
        systemRole,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        memo: line.memo,
      });
    }
    return out;
  }

  async postJournal(input: {
    organizationId: string;
    branchId?: string;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    memo: string;
    entryDate?: string;
    lines: Array<{
      code: string;
      name: string;
      accountType: string;
      systemRole?: string;
      debit: number;
      credit: number;
    }>;
  }) {
    const { data: existing } = await this.db
      .from("journal_entries")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    assertJournalBalanced(
      input.lines.map((l) => ({
        code: l.code,
        name: l.name,
        accountType: l.accountType as "asset",
        debit: l.debit,
        credit: l.credit,
      })),
    );

    const accountIds: string[] = [];
    for (const line of input.lines) {
      const { data: acc } = await this.db
        .from("accounts")
        .upsert(
          {
            organization_id: input.organizationId,
            code: line.code,
            name: line.name,
            account_type: line.accountType,
            system_role: line.systemRole ?? null,
            is_system: true,
          },
          { onConflict: "organization_id,code" },
        )
        .select("id")
        .single();
      accountIds.push(String(acc?.id));
    }

    const { data: entry, error } = await this.db
      .from("journal_entries")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        entry_number: `JE-${Date.now()}`,
        entry_date: input.entryDate ?? new Date().toISOString().slice(0, 10),
        memo: input.memo,
        source_type: input.sourceType,
        source_id: input.sourceId,
        status: "posted",
        idempotency_key: input.idempotencyKey,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { error: lineErr } = await this.db.from("journal_entry_lines").insert(
      input.lines.map((l, i) => ({
        organization_id: input.organizationId,
        journal_entry_id: entry.id,
        account_id: accountIds[i],
        debit: l.debit,
        credit: l.credit,
      })),
    );
    if (lineErr) throw lineErr;
    return entry;
  }

  private async journalLinesWithAccounts(organizationId: string, from?: string, to?: string) {
    let jq = this.db
      .from("journal_entries")
      .select("id,entry_date,status")
      .eq("organization_id", organizationId)
      .eq("status", "posted");
    if (from) jq = jq.gte("entry_date", from);
    if (to) jq = jq.lte("entry_date", to);
    const { data: entries, error } = await jq;
    if (error) throw error;
    const ids = (entries ?? []).map((e) => e.id);
    if (!ids.length) return [];

    const { data: lines, error: lineErr } = await this.db
      .from("journal_entry_lines")
      .select("debit,credit,account_id,accounts(code,name,account_type)")
      .eq("organization_id", organizationId)
      .in("journal_entry_id", ids);
    if (lineErr) throw lineErr;

    return (lines ?? []).map((l: Row) => {
      const acc = l.accounts as { code?: string; name?: string; account_type?: string } | null;
      return {
        accountCode: String(acc?.code ?? ""),
        accountName: String(acc?.name ?? ""),
        accountType: (acc?.account_type ?? "asset") as
          | "asset"
          | "liability"
          | "equity"
          | "income"
          | "expense",
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
      };
    });
  }

  private async accountBook(
    organizationId: string,
    accountCode: string,
    from?: string,
    to?: string,
    opening = 0,
  ) {
    const { data: acc } = await this.db
      .from("accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("code", accountCode)
      .maybeSingle();
    if (!acc) return buildCashBook([], opening);

    let jq = this.db
      .from("journal_entries")
      .select("id,entry_date,memo,status")
      .eq("organization_id", organizationId)
      .eq("status", "posted");
    if (from) jq = jq.gte("entry_date", from);
    if (to) jq = jq.lte("entry_date", to);
    const { data: entries } = await jq;
    const entryMap = new Map((entries ?? []).map((e) => [String(e.id), e]));
    const ids = [...entryMap.keys()];
    if (!ids.length) return buildCashBook([], opening);

    const { data: lines } = await this.db
      .from("journal_entry_lines")
      .select("*")
      .eq("account_id", acc.id)
      .in("journal_entry_id", ids);

    const bookLines = (lines ?? [])
      .map((l: Row) => {
        const je = entryMap.get(String(l.journal_entry_id));
        return {
          date: String(je?.entry_date ?? ""),
          memo: je?.memo ? String(je.memo) : "",
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return buildCashBook(bookLines, opening);
  }

  private async bankBookBalance(
    organizationId: string,
    bankAccountId: string,
    asOf: string,
  ): Promise<number> {
    const book = await this.reportBankBook(organizationId, bankAccountId, undefined, asOf);
    return book.closing;
  }

  private async partyBalances(organizationId: string, party: "customer" | "supplier") {
    if (party === "customer") {
      const { data, error } = await this.db
        .from("customers")
        .select("id,name,outstanding,credit_limit")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((c) => Number(c.outstanding ?? 0) !== 0);
    }
    const { data, error } = await this.db
      .from("suppliers")
      .select("id,company_name,payable_balance")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("company_name");
    if (error) throw error;
    return (data ?? []).filter((s) => Number(s.payable_balance ?? 0) !== 0);
  }
}
