import type { Customer } from "@electronic-erp/contracts";
import { commerceApi } from "@/features/crm/commerce-api";
import type { PosCustomerView } from "../types";

const FOCUS_KEY = "erp-pos-focused-customer-id";

export function mapCustomerToPos(c: Customer, loyaltyPoints = 0): PosCustomerView {
  return {
    id: c.id,
    label: c.name,
    priceTier:
      c.customerType === "wholesale" ? "Wholesale" : c.customerType === "dealer" ? "Dealer" : "Retail",
    creditLimit: Number(c.creditLimit ?? 0),
    outstanding: Number(c.outstanding ?? 0),
    loyaltyPoints,
    mobile: c.mobile ?? null,
  };
}

export async function enrichCustomerForPos(c: Customer): Promise<PosCustomerView> {
  let points = 0;
  try {
    const res = await commerceApi.account(c.id);
    const bal = res.item?.pointsBalance ?? res.item?.balance ?? res.item?.points;
    points = Number(bal ?? 0) || 0;
  } catch {
    /* loyalty optional */
  }
  return mapCustomerToPos(c, points);
}

export function getFocusedCustomerId(): string | null {
  try {
    return sessionStorage.getItem(FOCUS_KEY);
  } catch {
    return null;
  }
}

export function setFocusedCustomerId(id: string | null) {
  try {
    if (!id) sessionStorage.removeItem(FOCUS_KEY);
    else sessionStorage.setItem(FOCUS_KEY, id);
  } catch {
    /* ignore */
  }
}
