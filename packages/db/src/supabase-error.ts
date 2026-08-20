import { ConflictDomainError, ValidationDomainError } from "@electronic-erp/domain";

type DbErrorShape = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function asDbError(error: unknown): DbErrorShape | null {
  if (typeof error !== "object" || error === null) return null;
  return error as DbErrorShape;
}

export function postgresErrorCode(error: unknown): string | undefined {
  const rec = asDbError(error);
  return typeof rec?.code === "string" ? rec.code : undefined;
}

export function postgresErrorMessage(error: unknown): string {
  const rec = asDbError(error);
  if (typeof rec?.message === "string" && rec.message.trim()) return rec.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Database error";
}

export function conflictMessageForDbError(error: unknown): string {
  const haystack = [
    postgresErrorMessage(error),
    String(asDbError(error)?.details ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("barcodes") || (haystack.includes("(organization_id, code)") && haystack.includes("barcode"))) {
    return "A product with this barcode already exists";
  }
  if (haystack.includes("product_code") || haystack.includes("(organization_id, product_code)")) {
    return "A product with this product code already exists";
  }
  if (haystack.includes("sku") || haystack.includes("(organization_id, sku)")) {
    return "A product with this SKU already exists";
  }
  return "This value already exists";
}

/** Map a PostgREST/Supabase error into a domain error. Never returns silently. */
export function mapSupabaseError(error: unknown): Error {
  const code = postgresErrorCode(error);
  const message = postgresErrorMessage(error);

  if (code === "23505") {
    return new ConflictDomainError(conflictMessageForDbError(error));
  }
  if (code === "23503") {
    return new ValidationDomainError(
      "Related record was not found. Check organization, branch, warehouse, category, brand, or unit.",
    );
  }
  if (code === "23502") {
    return new ValidationDomainError("A required database field is missing");
  }
  if (error instanceof Error) return error;
  return new Error(message);
}

export function throwIfDbError(error: unknown): void {
  if (!error) return;
  throw mapSupabaseError(error);
}
