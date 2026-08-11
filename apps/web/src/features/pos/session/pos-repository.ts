/**
 * Thin POS client repository boundary.
 * UI calls these — never Supabase/SQLite directly from components.
 */
export type { ProductSearchResult, Sale } from "@electronic-erp/contracts";
export { posApi as posClientRepository } from "../pos-api";
