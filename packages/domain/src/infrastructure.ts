/** Phase 16 — security, backup planning, API keys, import/export helpers. */

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  sessionTtlHours: number;
  twoFactorOptional: boolean;
  twoFactorEnforced: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  sessionTtlHours: 24,
  twoFactorOptional: true,
  twoFactorEnforced: false,
};

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter");
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must include a number");
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include a symbol");
  }
  return { ok: errors.length === 0, errors };
}

export function isAccountLocked(input: {
  failedAttempts: number;
  lockedUntil?: string | null;
  maxFailedAttempts: number;
  now?: Date;
}): { locked: boolean; reason?: string } {
  const now = input.now ?? new Date();
  if (input.lockedUntil && new Date(input.lockedUntil).getTime() > now.getTime()) {
    return { locked: true, reason: `Locked until ${input.lockedUntil}` };
  }
  if (input.failedAttempts >= input.maxFailedAttempts) {
    return { locked: true, reason: "Too many failed login attempts" };
  }
  return { locked: false };
}

export function nextLockoutUntil(lockoutMinutes: number, now = new Date()): string {
  return new Date(now.getTime() + lockoutMinutes * 60_000).toISOString();
}

/** Architecture note — never claim field-level encryption without implementation. */
export function encryptionStrategySummary(): {
  inTransit: string;
  atRest: string;
  backups: string;
  secrets: string;
} {
  return {
    inTransit: "TLS for API and Supabase connections",
    atRest: "Supabase/Postgres storage encryption (provider)",
    backups: "Backup payloads marked encrypted=true; ciphertext handled by backup adapter",
    secrets:
      "Service role and API key secrets stay server-side; frontend may only use anon key + user JWT",
  };
}

export function planBackupJob(input: {
  mode: "full" | "incremental" | "daily" | "automatic";
  target: "local" | "cloud";
  encrypted: boolean;
}): {
  status: "queued";
  scheduledFor: string;
  incrementalBaseRequired: boolean;
  disasterRecoveryClaim: false;
  verificationRequired: true;
  notes: string[];
} {
  const scheduledFor = new Date().toISOString();
  return {
    status: "queued",
    scheduledFor,
    incrementalBaseRequired: input.mode === "incremental",
    disasterRecoveryClaim: false,
    verificationRequired: true,
    notes: [
      `Mode=${input.mode}, target=${input.target}, encrypted=${input.encrypted}`,
      "Disaster recovery is not claimed until restore verification succeeds.",
      "Restore requests default to verify-only until an operator confirms a tested restore.",
    ],
  };
}

export function hashApiKey(rawKey: string): string {
  // Deterministic non-crypto fingerprint for local matching (server stores hash only).
  let h = 2166136261;
  for (let i = 0; i < rawKey.length; i++) {
    h ^= rawKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `k_${(h >>> 0).toString(16).padStart(8, "0")}_${rawKey.slice(-4)}`;
}

export function generateApiKeyMaterial(audience: string): { rawKey: string; prefix: string } {
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  const prefix = `erp_${audience.slice(0, 6)}_${rand.slice(0, 6)}`;
  const rawKey = `${prefix}_${rand}`;
  return { rawKey, prefix };
}

export function assertBulkPricePermission(canWritePricing: boolean): void {
  if (!canWritePricing) {
    throw new Error("Forbidden: bulk price updates require pricing.write or products.write");
  }
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

/** Excel-compatible TSV (opens in Excel without a binary xlsx dependency). */
export function rowsToExcelTsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers.join("\t"), ...rows.map((r) => r.map((c) => String(c ?? "")).join("\t"))].join(
    "\n",
  );
}

/** Minimal text PDF payload (architecture export; not a full PDF engine). */
export function rowsToSimplePdf(title: string, lines: string[]): string {
  const body = [`%PDF-1.1`, `% ${title}`, ...lines.map((l, i) => `${i + 1}: ${l}`), `%%EOF`];
  return body.join("\n");
}

export const INTEGRATION_AUDIENCES = [
  "mobile",
  "website",
  "payment_gateway",
  "bank",
  "courier",
  "whatsapp",
  "sms",
  "accounting",
  "ecommerce",
  "custom",
] as const;
