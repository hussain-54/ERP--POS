import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}
function str(v: unknown): string {
  return String(v ?? "");
}

/** Catalog row shaped for @electronic-erp/ai matchers (no AI logic here). */
export interface AiCatalogRow {
  productId: string;
  name: string;
  sku?: string | null;
  brand?: string | null;
  company?: string | null;
  model?: string | null;
  size?: string | null;
  color?: string | null;
  watt?: number | null;
  unitName?: string | null;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  stockAvailable?: number | null;
  specificationsText?: string | null;
}

export interface AiVelocityRow {
  productId: string;
  productName: string;
  qtySold: number;
  lastSoldAt?: string | null;
  qtyOnHand: number;
  minStock?: number;
  maxStock?: number;
  avgUnitCost?: number;
  retailPrice?: number;
  preferredSupplierId?: string | null;
  preferredSupplierName?: string | null;
  lastPurchaseRate?: number | null;
  leadTimeDays?: number;
}

export class AiRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getSettings(organizationId: string) {
    const { data } = await this.db
      .from("ai_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    return (
      data ?? {
        organization_id: organizationId,
        confidence_threshold: 0.78,
        fast_days: 30,
        slow_days: 90,
        stagnant_days: 180,
      }
    );
  }

  async upsertSettings(
    organizationId: string,
    input: {
      confidenceThreshold?: number;
      fastDays?: number;
      slowDays?: number;
      stagnantDays?: number;
    },
    userId: string | null,
  ) {
    const current = await this.getSettings(organizationId);
    const row = {
      organization_id: organizationId,
      confidence_threshold: input.confidenceThreshold ?? num(current.confidence_threshold),
      fast_days: input.fastDays ?? num(current.fast_days),
      slow_days: input.slowDays ?? num(current.slow_days),
      stagnant_days: input.stagnantDays ?? num(current.stagnant_days),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    const { data, error } = await this.db
      .from("ai_settings")
      .upsert(row, { onConflict: "organization_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async loadCatalogCandidates(
    organizationId: string,
    warehouseId: string | undefined,
    hintToken?: string,
  ): Promise<AiCatalogRow[]> {
    let query = this.db
      .from("products")
      .select(
        "id,name,sku,retail_price,wholesale_price,brand_id,company_id,model_id,base_unit_id",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(400);

    if (hintToken?.trim()) {
      const token = hintToken.trim().split(/\s+/)[0]!;
      query = query.or(`name.ilike.%${token}%,sku.ilike.%${token}%`);
    }

    const { data: products, error } = await query;
    if (error) throw error;
    const list = (products ?? []) as Row[];
    if (!list.length) {
      const { data: fallback } = await this.db
        .from("products")
        .select(
          "id,name,sku,retail_price,wholesale_price,brand_id,company_id,model_id,base_unit_id",
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .limit(200);
      list.push(...((fallback ?? []) as Row[]));
    }

    const brandIds = [...new Set(list.map((p) => str(p.brand_id)).filter(Boolean))];
    const companyIds = [...new Set(list.map((p) => str(p.company_id)).filter(Boolean))];
    const modelIds = [...new Set(list.map((p) => str(p.model_id)).filter(Boolean))];
    const unitIds = [...new Set(list.map((p) => str(p.base_unit_id)).filter(Boolean))];
    const productIds = list.map((p) => str(p.id));

    const [brands, companies, models, units, specs, balances] = await Promise.all([
      brandIds.length
        ? this.db.from("brands").select("id,name").in("id", brandIds)
        : Promise.resolve({ data: [] }),
      companyIds.length
        ? this.db.from("companies").select("id,name").in("id", companyIds)
        : Promise.resolve({ data: [] }),
      modelIds.length
        ? this.db.from("product_models").select("id,name").in("id", modelIds)
        : Promise.resolve({ data: [] }),
      unitIds.length
        ? this.db.from("units").select("id,name").in("id", unitIds)
        : Promise.resolve({ data: [] }),
      productIds.length
        ? this.db
            .from("product_specifications")
            .select("product_id,size,color,watt,model_label,material,voltage")
            .in("product_id", productIds)
        : Promise.resolve({ data: [] }),
      warehouseId && productIds.length
        ? this.db
            .from("stock_balances")
            .select("product_id,qty_on_hand,qty_reserved")
            .eq("warehouse_id", warehouseId)
            .in("product_id", productIds)
        : Promise.resolve({ data: [] }),
    ]);

    const brandMap = new Map((brands.data ?? []).map((r: Row) => [str(r.id), str(r.name)]));
    const companyMap = new Map((companies.data ?? []).map((r: Row) => [str(r.id), str(r.name)]));
    const modelMap = new Map((models.data ?? []).map((r: Row) => [str(r.id), str(r.name)]));
    const unitMap = new Map((units.data ?? []).map((r: Row) => [str(r.id), str(r.name)]));
    const specMap = new Map((specs.data ?? []).map((r: Row) => [str(r.product_id), r]));
    const stockMap = new Map(
      (balances.data ?? []).map((r: Row) => [
        str(r.product_id),
        num(r.qty_on_hand) - num(r.qty_reserved),
      ]),
    );

    return list.map((p) => {
      const spec = specMap.get(str(p.id)) as Row | undefined;
      return {
        productId: str(p.id),
        name: str(p.name),
        sku: p.sku ? str(p.sku) : null,
        brand: brandMap.get(str(p.brand_id)) ?? null,
        company: companyMap.get(str(p.company_id)) ?? null,
        model: modelMap.get(str(p.model_id)) ?? (spec?.model_label ? str(spec.model_label) : null),
        size: spec?.size ? str(spec.size) : null,
        color: spec?.color ? str(spec.color) : null,
        watt: spec?.watt != null ? num(spec.watt) : null,
        unitName: unitMap.get(str(p.base_unit_id)) ?? null,
        retailPrice: num(p.retail_price),
        wholesalePrice: num(p.wholesale_price),
        stockAvailable: warehouseId ? (stockMap.get(str(p.id)) ?? 0) : null,
        specificationsText: [
          spec?.size,
          spec?.color,
          spec?.watt,
          spec?.voltage,
          spec?.material,
          spec?.model_label,
        ]
          .filter((x) => x != null && String(x).length)
          .join(" "),
      };
    });
  }

  async insertRecognitionEvent(row: Record<string, unknown>) {
    const { data, error } = await this.db
      .from("ai_recognition_events")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async confirmRecognition(input: {
    organizationId: string;
    recognitionEventId: string;
    productId?: string;
    action: "confirm_match" | "manual_select" | "manual_search" | "new_product";
  }) {
    const { data: event, error } = await this.db
      .from("ai_recognition_events")
      .select("*")
      .eq("id", input.recognitionEventId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!event) throw new Error("Recognition event not found");

    if (input.action === "new_product") {
      const { data, error: upErr } = await this.db
        .from("ai_recognition_events")
        .update({
          status: "rejected",
          confirm_action: input.action,
          confirmed_at: new Date().toISOString(),
          selected_product_id: null,
        })
        .eq("id", input.recognitionEventId)
        .select("*")
        .single();
      if (upErr) throw upErr;
      return {
        item: data,
        message:
          "New product option recorded — AI did not auto-create a product. Create via catalog with approval.",
      };
    }

    const { data, error: upErr } = await this.db
      .from("ai_recognition_events")
      .update({
        status: "confirmed",
        confirm_action: input.action,
        confirmed_at: new Date().toISOString(),
        selected_product_id: input.productId ?? null,
      })
      .eq("id", input.recognitionEventId)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return { item: data, message: "Match confirmed for POS handoff" };
  }

  async loadDailySales(organizationId: string, lookbackDays: number, branchId?: string) {
    const from = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
    let q = this.db
      .from("sales")
      .select("posted_at,grand_total,id")
      .eq("organization_id", organizationId)
      .gte("posted_at", from)
      .order("posted_at", { ascending: true })
      .limit(5000);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    const byDay = new Map<string, number>();
    for (const r of (data ?? []) as Row[]) {
      const day = str(r.posted_at).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + num(r.grand_total));
    }
    return [...byDay.entries()].map(([date, amount]) => ({ date, amount }));
  }

  async loadInsightFacts(
    organizationId: string,
    lookbackDays: number,
    warehouseId?: string,
  ): Promise<{
    products: AiVelocityRow[];
    productSeries: Array<{
      productId: string;
      productName: string;
      points: Array<{ date: string; amount: number; qty?: number }>;
    }>;
    baskets: Array<{ saleId: string; productIds: string[] }>;
    margins: Array<{
      productId: string;
      productName: string;
      revenue: number;
      cost: number;
      qtySold: number;
    }>;
  }> {
    const from = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
    const { data: sales } = await this.db
      .from("sales")
      .select("id,posted_at")
      .eq("organization_id", organizationId)
      .gte("posted_at", from)
      .limit(3000);
    const saleIds = (sales ?? []).map((s: Row) => str(s.id));
    const salePosted = new Map((sales ?? []).map((s: Row) => [str(s.id), str(s.posted_at)]));

    let items: Row[] = [];
    if (saleIds.length) {
      const { data } = await this.db
        .from("sale_items")
        .select("sale_id,product_id,qty,line_total,cost_price")
        .in("sale_id", saleIds.slice(0, 1000))
        .limit(8000);
      items = (data ?? []) as Row[];
    }

    const qtySold = new Map<string, number>();
    const lastSold = new Map<string, string>();
    const revenue = new Map<string, number>();
    const cost = new Map<string, number>();
    const dayQty = new Map<string, Map<string, number>>();
    const basketsMap = new Map<string, string[]>();

    for (const it of items) {
      const pid = str(it.product_id);
      if (!pid || pid === "null") continue;
      const q = num(it.qty);
      qtySold.set(pid, (qtySold.get(pid) ?? 0) + q);
      revenue.set(pid, (revenue.get(pid) ?? 0) + num(it.line_total));
      cost.set(pid, (cost.get(pid) ?? 0) + num(it.cost_price) * q);
      const posted = salePosted.get(str(it.sale_id));
      if (posted) {
        const prev = lastSold.get(pid);
        if (!prev || posted > prev) lastSold.set(pid, posted);
        const day = posted.slice(0, 10);
        if (!dayQty.has(pid)) dayQty.set(pid, new Map());
        const m = dayQty.get(pid)!;
        m.set(day, (m.get(day) ?? 0) + q);
      }
      const bid = str(it.sale_id);
      if (!basketsMap.has(bid)) basketsMap.set(bid, []);
      basketsMap.get(bid)!.push(pid);
    }

    const { data: products } = await this.db
      .from("products")
      .select("id,name,retail_price,reorder_level")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .limit(2000);
    const nameMap = new Map((products ?? []).map((p: Row) => [str(p.id), str(p.name)]));
    const priceMap = new Map((products ?? []).map((p: Row) => [str(p.id), num(p.retail_price)]));
    const reorderMap = new Map(
      (products ?? []).map((p: Row) => [str(p.id), num(p.reorder_level)]),
    );

    let balances: Row[] = [];
    {
      let bq = this.db
        .from("stock_balances")
        .select("product_id,qty_on_hand,average_unit_cost")
        .eq("organization_id", organizationId)
        .limit(5000);
      if (warehouseId) bq = bq.eq("warehouse_id", warehouseId);
      const { data } = await bq;
      balances = (data ?? []) as Row[];
    }
    const stockMap = new Map<string, { qty: number; cost: number }>();
    for (const b of balances) {
      const pid = str(b.product_id);
      const cur = stockMap.get(pid) ?? { qty: 0, cost: 0 };
      cur.qty += num(b.qty_on_hand);
      cur.cost = num(b.average_unit_cost) || cur.cost;
      stockMap.set(pid, cur);
    }

    const { data: purchaseItems } = await this.db
      .from("purchase_items")
      .select("product_id,unit_cost,purchase_id")
      .eq("organization_id", organizationId)
      .limit(2000);
    const lastRate = new Map<string, number>();
    const purchaseIds: string[] = [];
    for (const pi of (purchaseItems ?? []) as Row[]) {
      const pid = str(pi.product_id);
      if (!lastRate.has(pid)) {
        lastRate.set(pid, num(pi.unit_cost));
        purchaseIds.push(str(pi.purchase_id));
      }
    }
    const { data: purchases } = purchaseIds.length
      ? await this.db
          .from("purchases")
          .select("id,supplier_id")
          .in("id", [...new Set(purchaseIds)].slice(0, 500))
      : { data: [] };
    const purchaseSupplier = new Map(
      (purchases ?? []).map((p: Row) => [str(p.id), str(p.supplier_id)]),
    );
    const supplierByProduct = new Map<string, string>();
    for (const pi of (purchaseItems ?? []) as Row[]) {
      const pid = str(pi.product_id);
      if (supplierByProduct.has(pid)) continue;
      const sid = purchaseSupplier.get(str(pi.purchase_id));
      if (sid) supplierByProduct.set(pid, sid);
    }
    const supplierIds = [...new Set(supplierByProduct.values())];
    const { data: suppliers } = supplierIds.length
      ? await this.db.from("suppliers").select("id,name").in("id", supplierIds)
      : { data: [] };
    const supplierNames = new Map((suppliers ?? []).map((s: Row) => [str(s.id), str(s.name)]));

    const allIds = new Set([
      ...qtySold.keys(),
      ...[...(products ?? [])].map((p: Row) => str(p.id)),
      ...stockMap.keys(),
    ]);

    const velocity: AiVelocityRow[] = [];
    const productSeries: Array<{
      productId: string;
      productName: string;
      points: Array<{ date: string; amount: number; qty?: number }>;
    }> = [];
    const margins: Array<{
      productId: string;
      productName: string;
      revenue: number;
      cost: number;
      qtySold: number;
    }> = [];

    for (const pid of allIds) {
      const name = nameMap.get(pid) ?? pid;
      const stock = stockMap.get(pid);
      const sid = supplierByProduct.get(pid) ?? null;
      const reorder = reorderMap.get(pid) || 5;
      velocity.push({
        productId: pid,
        productName: name,
        qtySold: qtySold.get(pid) ?? 0,
        lastSoldAt: lastSold.get(pid) ?? null,
        qtyOnHand: stock?.qty ?? 0,
        minStock: reorder,
        maxStock: Math.max(reorder * 4, 50),
        avgUnitCost: stock?.cost,
        retailPrice: priceMap.get(pid),
        preferredSupplierId: sid,
        preferredSupplierName: sid ? (supplierNames.get(sid) ?? null) : null,
        lastPurchaseRate: lastRate.get(pid) ?? null,
        leadTimeDays: 7,
      });
      const points = [...(dayQty.get(pid)?.entries() ?? [])].map(([date, qty]) => ({
        date,
        amount: qty,
        qty,
      }));
      if (points.length) productSeries.push({ productId: pid, productName: name, points });
      if ((qtySold.get(pid) ?? 0) > 0) {
        margins.push({
          productId: pid,
          productName: name,
          revenue: revenue.get(pid) ?? 0,
          cost: cost.get(pid) ?? 0,
          qtySold: qtySold.get(pid) ?? 0,
        });
      }
    }

    return {
      products: velocity,
      productSeries,
      baskets: [...basketsMap.entries()].map(([saleId, productIds]) => ({
        saleId,
        productIds,
      })),
      margins,
    };
  }

  async cacheInsight(row: Record<string, unknown>) {
    const { error } = await this.db.from("ai_insight_cache").insert(row);
    if (error) throw error;
  }
}
