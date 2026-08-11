import { ValidationDomainError } from "./errors.js";

export interface WarrantyRecord {
  id: string;
  saleId: string;
  productId: string | null;
  serialNumberId: string | null;
  warrantyStart: string;
  warrantyEnd: string;
}

export function isWarrantyActive(record: WarrantyRecord, asOf = new Date()): boolean {
  const start = new Date(record.warrantyStart);
  const end = new Date(record.warrantyEnd);
  const day = new Date(asOf.toISOString().slice(0, 10));
  return day >= start && day <= end;
}

export function assertWarrantyClaimAllowed(record: WarrantyRecord, asOf = new Date()): void {
  if (!isWarrantyActive(record, asOf)) {
    throw new ValidationDomainError(
      `Warranty expired or not started (end ${record.warrantyEnd})`,
    );
  }
}

export function assertSerialMatchesWarranty(
  warranty: WarrantyRecord,
  serialNumberId?: string | null,
  serialCodeFoundId?: string | null,
): void {
  if (!serialNumberId && !serialCodeFoundId) return;
  const expected = warranty.serialNumberId;
  if (!expected) return;
  const provided = serialNumberId ?? serialCodeFoundId;
  if (provided && provided !== expected) {
    throw new ValidationDomainError("Serial does not match warranty record from original sale");
  }
}
