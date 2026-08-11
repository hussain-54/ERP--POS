import type {
  CreateB2bOrderInput,
  CreateCampaignInput,
  CreateLoyaltyOfferSchema,
  CreateSegmentInput,
  EarnLoyaltyPointsSchema,
  RedeemLoyaltyPointsSchema,
  StoreCheckoutInput,
  UpsertStoreSettingsSchema,
} from "@electronic-erp/contracts";
import { z } from "zod";
import {
  assertRedeemable,
  assertStoreStock,
  buildOnlineOrderNotes,
  buyingPatternSummary,
  calculateEarnPoints,
  campaignNeedsSegment,
  customerMatchesSegment,
  DEFAULT_LOYALTY_TIERS,
  pickProductPrice,
  priceBookForCustomerType,
  resolveTier,
  ValidationDomainError,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";
import { AfterSalesRepository } from "./after-sales-repository.js";

type Row = Record<string, unknown>;
type CreateLoyaltyOfferInput = z.input<typeof CreateLoyaltyOfferSchema>;
type EarnInput = z.input<typeof EarnLoyaltyPointsSchema>;
type RedeemInput = z.input<typeof RedeemLoyaltyPointsSchema>;
type StoreSettingsInput = z.input<typeof UpsertStoreSettingsSchema>;

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}
function str(v: unknown): string {
  return String(v ?? "");
}

export class CommerceRepository {
  private readonly afterSales: AfterSalesRepository;

  constructor(private readonly db: DatabaseClient) {
    this.afterSales = new AfterSalesRepository(db);
  }

  // ─── CRM ───────────────────────────────────────────────

  async createSegment(input: CreateSegmentInput) {
    const { data, error } = await this.db
      .from("customer_segments")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        rule_json: input.ruleJson ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listSegments(organizationId: string) {
    const { data, error } = await this.db
      .from("customer_segments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async refreshSegmentMembers(organizationId: string, segmentId: string) {
    const { data: segment } = await this.db
      .from("customer_segments")
      .select("*")
      .eq("id", segmentId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!segment) throw new ValidationDomainError("Segment not found");

    const { data: customers } = await this.db
      .from("customers")
      .select("id,customer_type,location_city,outstanding,total_purchases,loyalty_tier")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .limit(5000);

    const matched = ((customers ?? []) as Row[]).filter((c) =>
      customerMatchesSegment(
        {
          id: str(c.id),
          customerType: str(c.customer_type) as "retail" | "wholesale" | "dealer",
          locationCity: c.location_city ? str(c.location_city) : null,
          outstanding: num(c.outstanding),
          totalPurchases: num(c.total_purchases),
          loyaltyTier: c.loyalty_tier as "silver" | "gold" | "platinum" | null,
        },
        (segment.rule_json as Record<string, unknown>) ?? {},
      ),
    );

    await this.db
      .from("customer_segment_members")
      .delete()
      .eq("segment_id", segmentId)
      .eq("organization_id", organizationId);

    if (matched.length) {
      const { error } = await this.db.from("customer_segment_members").insert(
        matched.map((c) => ({
          organization_id: organizationId,
          segment_id: segmentId,
          customer_id: str(c.id),
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { segmentId, memberCount: matched.length };
  }

  async customerCrmProfile(organizationId: string, customerId: string) {
    const { data: customer, error } = await this.db
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new ValidationDomainError("Customer not found");

    const { data: sales } = await this.db
      .from("sales")
      .select("id,posted_at,grand_total")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("status", "posted")
      .order("posted_at", { ascending: false })
      .limit(100);

    const saleIds = ((sales ?? []) as Row[]).map((s) => str(s.id));
    const productIdsBySale = new Map<string, string[]>();
    if (saleIds.length) {
      const { data: items } = await this.db
        .from("sale_items")
        .select("sale_id,product_id")
        .in("sale_id", saleIds.slice(0, 100));
      for (const i of (items ?? []) as Row[]) {
        const sid = str(i.sale_id);
        const list = productIdsBySale.get(sid) ?? [];
        if (i.product_id) list.push(str(i.product_id));
        productIdsBySale.set(sid, list);
      }
    }

    const patterns = buyingPatternSummary(
      ((sales ?? []) as Row[]).map((s) => ({
        postedAt: str(s.posted_at),
        grandTotal: num(s.grand_total),
        productIds: productIdsBySale.get(str(s.id)) ?? [],
      })),
    );

    const { data: memberships } = await this.db
      .from("customer_segment_members")
      .select("segment_id")
      .eq("customer_id", customerId)
      .eq("organization_id", organizationId);
    const segmentIds = ((memberships ?? []) as Row[]).map((m) => str(m.segment_id));
    let segments: Row[] = [];
    if (segmentIds.length) {
      const { data } = await this.db
        .from("customer_segments")
        .select("id,code,name")
        .in("id", segmentIds);
      segments = (data ?? []) as Row[];
    }

    return {
      customer,
      purchaseHistory: sales ?? [],
      buyingPatterns: patterns,
      location: {
        city: customer.location_city ?? null,
        area: customer.location_area ?? null,
        address: customer.address ?? null,
      },
      customerType: customer.customer_type,
      segments,
    };
  }

  async createCampaign(input: CreateCampaignInput, userId?: string | null) {
    if (campaignNeedsSegment(input.channel) && !input.segmentId && !input.customerId) {
      throw new ValidationDomainError("Campaign requires segmentId or customerId");
    }
    if (input.channel === "customer_specific" && !input.customerId) {
      throw new ValidationDomainError("Customer-specific campaign requires customerId");
    }
    const { data, error } = await this.db
      .from("crm_campaigns")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        channel: input.channel,
        segment_id: input.segmentId ?? null,
        customer_id: input.customerId ?? null,
        message_template: input.messageTemplate,
        offer_percent: input.offerPercent ?? null,
        offer_amount: input.offerAmount ?? null,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listCampaigns(organizationId: string) {
    const { data, error } = await this.db
      .from("crm_campaigns")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /** Queue campaign sends (provider adapters can process later). */
  async runCampaign(organizationId: string, campaignId: string) {
    const { data: campaign } = await this.db
      .from("crm_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!campaign) throw new ValidationDomainError("Campaign not found");

    let customerIds: string[] = [];
    if (campaign.customer_id) {
      customerIds = [str(campaign.customer_id)];
    } else if (campaign.segment_id) {
      const { data: members } = await this.db
        .from("customer_segment_members")
        .select("customer_id")
        .eq("segment_id", str(campaign.segment_id));
      customerIds = ((members ?? []) as Row[]).map((m) => str(m.customer_id));
    }

    const rows = customerIds.map((customerId) => ({
      organization_id: organizationId,
      campaign_id: campaignId,
      customer_id: customerId,
      channel: str(campaign.channel),
      status: "queued",
    }));
    if (rows.length) {
      const { error } = await this.db.from("crm_campaign_sends").insert(rows);
      if (error) throw new Error(error.message);
    }
    await this.db
      .from("crm_campaigns")
      .update({ status: "running" })
      .eq("id", campaignId);
    return { queued: rows.length, channel: campaign.channel };
  }

  // ─── Loyalty ───────────────────────────────────────────

  async seedLoyaltyTiers(organizationId: string) {
    for (const t of DEFAULT_LOYALTY_TIERS) {
      await this.db.from("loyalty_tiers").upsert(
        {
          organization_id: organizationId,
          code: t.code,
          name: t.name,
          min_points: t.minPoints,
          earn_rate: t.earnRate,
          redeem_rate: t.redeemRate,
          is_active: true,
        },
        { onConflict: "organization_id,code" },
      );
    }
    const { data } = await this.db
      .from("loyalty_tiers")
      .select("*")
      .eq("organization_id", organizationId);
    return data ?? [];
  }

  private async ensureLoyaltyAccount(organizationId: string, customerId: string) {
    const { data: existing } = await this.db
      .from("loyalty_accounts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await this.db
      .from("loyalty_accounts")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        tier_code: "silver",
        points_balance: 0,
        lifetime_points: 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async earnPoints(input: EarnInput, userId?: string | null) {
    const account = await this.ensureLoyaltyAccount(input.organizationId, input.customerId);
    const { data: tier } = await this.db
      .from("loyalty_tiers")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("code", str(account.tier_code))
      .maybeSingle();
    const earnRate = num(tier?.earn_rate ?? 1);
    const points = calculateEarnPoints(Number(input.purchaseAmount), earnRate);
    if (points <= 0) return account;

    const lifetime = num(account.lifetime_points) + points;
    const balance = num(account.points_balance) + points;
    const nextTier = resolveTier(lifetime);
    const { data: updated, error } = await this.db
      .from("loyalty_accounts")
      .update({
        points_balance: balance,
        lifetime_points: lifetime,
        tier_code: nextTier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await this.db.from("loyalty_ledger").insert({
      organization_id: input.organizationId,
      account_id: account.id,
      customer_id: input.customerId,
      entry_type: "earn",
      points,
      balance_after: balance,
      source_type: input.sourceType ?? "sale",
      source_id: input.sourceId ?? null,
      expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      notes: input.notes ?? null,
      created_by: userId ?? null,
    });

    await this.db
      .from("customers")
      .update({ loyalty_tier: nextTier })
      .eq("id", input.customerId);

    return updated;
  }

  async redeemPoints(input: RedeemInput, userId?: string | null) {
    const account = await this.ensureLoyaltyAccount(input.organizationId, input.customerId);
    let offer: { pointsCost: number; endsAt?: string | null; isActive?: boolean } | undefined;
    if (input.offerId) {
      const { data: o } = await this.db
        .from("loyalty_offers")
        .select("*")
        .eq("id", input.offerId)
        .eq("organization_id", input.organizationId)
        .maybeSingle();
      if (!o) throw new ValidationDomainError("Offer not found");
      offer = {
        pointsCost: num(o.points_cost),
        endsAt: o.ends_at ? str(o.ends_at) : null,
        isActive: Boolean(o.is_active),
      };
    }
    assertRedeemable(num(account.points_balance), input.points, offer);
    const balance = num(account.points_balance) - input.points;
    const { data: updated, error } = await this.db
      .from("loyalty_accounts")
      .update({ points_balance: balance, updated_at: new Date().toISOString() })
      .eq("id", account.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await this.db.from("loyalty_ledger").insert({
      organization_id: input.organizationId,
      account_id: account.id,
      customer_id: input.customerId,
      entry_type: "redeem",
      points: -input.points,
      balance_after: balance,
      source_type: input.sourceType ?? "redemption",
      source_id: input.sourceId ?? input.offerId ?? null,
      notes: input.notes ?? null,
      created_by: userId ?? null,
    });
    return updated;
  }

  async listLoyaltyLedger(organizationId: string, customerId: string) {
    const { data, error } = await this.db
      .from("loyalty_ledger")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getLoyaltyAccount(organizationId: string, customerId: string) {
    return this.ensureLoyaltyAccount(organizationId, customerId);
  }

  async createLoyaltyOffer(input: CreateLoyaltyOfferInput) {
    const { data, error } = await this.db
      .from("loyalty_offers")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        tier_code: input.tierCode ?? null,
        points_cost: input.pointsCost,
        discount_percent: input.discountPercent ?? null,
        discount_amount: input.discountAmount ?? null,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listLoyaltyOffers(organizationId: string) {
    const { data, error } = await this.db
      .from("loyalty_offers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async expirePoints(organizationId: string, asOf = new Date()) {
    const { data: rows } = await this.db
      .from("loyalty_ledger")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("entry_type", "earn")
      .lt("expires_at", asOf.toISOString())
      .limit(500);
    let expired = 0;
    for (const row of (rows ?? []) as Row[]) {
      // Soft expiry log — production would track remaining unredeemed lots.
      await this.db.from("loyalty_ledger").insert({
        organization_id: organizationId,
        account_id: row.account_id,
        customer_id: row.customer_id,
        entry_type: "expire",
        points: 0,
        balance_after: 0,
        source_type: "expiry",
        source_id: row.id,
        notes: "Expired earn lot",
      });
      expired += 1;
    }
    return { expiredLots: expired };
  }

  // ─── B2B ───────────────────────────────────────────────

  async createB2bPortalUser(input: {
    organizationId: string;
    customerId: string;
    email: string;
    displayName?: string;
    authUserId?: string;
  }) {
    const { data: customer } = await this.db
      .from("customers")
      .select("id,customer_type")
      .eq("id", input.customerId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (!customer) throw new ValidationDomainError("Customer not found");
    if (!["wholesale", "dealer"].includes(str(customer.customer_type))) {
      throw new ValidationDomainError("B2B portal requires wholesale or dealer customer");
    }
    const { data, error } = await this.db
      .from("b2b_portal_users")
      .insert({
        organization_id: input.organizationId,
        customer_id: input.customerId,
        email: input.email,
        display_name: input.displayName ?? null,
        auth_user_id: input.authUserId ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listB2bUsers(organizationId: string) {
    const { data, error } = await this.db
      .from("b2b_portal_users")
      .select("*")
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async b2bPricing(organizationId: string, customerId: string, productIds: string[]) {
    const { data: customer } = await this.db
      .from("customers")
      .select("customer_type")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!customer) throw new ValidationDomainError("Customer not found");
    const book = priceBookForCustomerType(
      str(customer.customer_type) as "retail" | "wholesale" | "dealer",
    );
    const { data: products } = await this.db
      .from("products")
      .select("id,name,retail_price,wholesale_price,dealer_price,base_unit_id")
      .eq("organization_id", organizationId)
      .in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
    return ((products ?? []) as Row[]).map((p) => ({
      productId: str(p.id),
      name: str(p.name),
      priceBook: book,
      unitPrice: pickProductPrice(
        {
          retailPrice: num(p.retail_price),
          wholesalePrice: num(p.wholesale_price),
          dealerPrice: num(p.dealer_price),
        },
        book,
      ),
      unitId: str(p.base_unit_id),
    }));
  }

  async createB2bOrder(input: CreateB2bOrderInput, userId?: string | null) {
    const priced = await this.b2bPricing(
      input.organizationId,
      input.customerId,
      input.items.map((i) => i.productId),
    );
    const priceMap = new Map(priced.map((p) => [p.productId, p]));

    const { data: balances } = await this.db
      .from("stock_balances")
      .select("product_id,variant_id,qty_on_hand,qty_reserved")
      .eq("organization_id", input.organizationId)
      .eq("warehouse_id", input.warehouseId)
      .in(
        "product_id",
        input.items.map((i) => i.productId),
      );
    assertStoreStock(
      input.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: Number(i.qty),
      })),
      ((balances ?? []) as Row[]).map((b) => ({
        productId: str(b.product_id),
        variantId: b.variant_id ? str(b.variant_id) : null,
        qtyOnHand: num(b.qty_on_hand),
        qtyReserved: num(b.qty_reserved),
      })),
    );

    const items = input.items.map((i) => {
      const p = priceMap.get(i.productId);
      return {
        productId: i.productId,
        variantId: i.variantId,
        unitId: i.unitId || p?.unitId || i.unitId,
        qty: i.qty,
        unitPrice: i.unitPrice ?? p?.unitPrice ?? 0,
        discount: 0,
        tax: 0,
      };
    });

    const order = await this.afterSales.createSalesOrder(
      {
        organizationId: input.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        customerId: input.customerId,
        items,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        channel: "b2b",
        approvalStatus: input.requireApproval ? "pending" : "approved",
        priceBook: priced[0]?.priceBook ?? "wholesale",
      },
      userId,
    );

    if (input.requireApproval) {
      await this.db.from("approval_requests").insert({
        organization_id: input.organizationId,
        workflow_type: "b2b_order",
        status: "pending",
        entity_type: "sales_order",
        entity_id: order.id,
        title: `B2B order ${String(order.order_number ?? order.id)}`,
        requester_user_id: userId ?? null,
        payload: { orderId: order.id, channel: "b2b" },
      });
    }

    // Reserve stock against ERP inventory
    for (const i of items) {
      await this.db.from("stock_reservations").insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        product_id: i.productId,
        variant_id: i.variantId ?? null,
        unit_id: i.unitId,
        qty: Number(i.qty),
        source_type: "b2b_order",
        source_id: order.id,
        status: "active",
      });
    }

    return order;
  }

  async approveB2bOrder(organizationId: string, orderId: string, approve: boolean) {
    const { data: order } = await this.db
      .from("sales_orders")
      .select("*")
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .eq("channel", "b2b")
      .maybeSingle();
    if (!order) throw new ValidationDomainError("B2B order not found");
    const status = approve ? "approved" : "rejected";
    const { data, error } = await this.db
      .from("sales_orders")
      .update({
        approval_status: status,
        status: approve ? "confirmed" : "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async b2bCustomerPortal(organizationId: string, customerId: string) {
    const { data: customer } = await this.db
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!customer) throw new ValidationDomainError("Customer not found");

    const [{ data: orders }, { data: quotes }, { data: payments }, { data: ledger }] =
      await Promise.all([
        this.db
          .from("sales_orders")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        this.db
          .from("quotations")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        this.db
          .from("payments")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
        this.db
          .from("party_ledger_entries")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .order("occurred_at", { ascending: false })
          .limit(100),
      ]);

    const lastOrder = ((orders ?? []) as Row[])[0];
    let reorderItems: Row[] = [];
    if (lastOrder) {
      const { data: items } = await this.db
        .from("sales_order_items")
        .select("*")
        .eq("sales_order_id", str(lastOrder.id));
      reorderItems = (items ?? []) as Row[];
    }

    return {
      customer,
      creditAccount: {
        creditLimit: customer.credit_limit,
        outstanding: customer.outstanding,
        creditDays: customer.credit_days,
        isBlocked: customer.is_blocked,
      },
      invoiceHistory: orders ?? [],
      quotations: quotes ?? [],
      paymentHistory: payments ?? [],
      outstandingLedger: ledger ?? [],
      reorderFromLast: reorderItems,
    };
  }

  // ─── Online store ──────────────────────────────────────

  async upsertStoreSettings(input: StoreSettingsInput) {
    const { data, error } = await this.db
      .from("store_settings")
      .upsert(
        {
          organization_id: input.organizationId,
          branch_id: input.branchId,
          warehouse_id: input.warehouseId,
          store_name: input.storeName ?? "Online Store",
          is_published: input.isPublished ?? false,
          currency: input.currency ?? "PKR",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getStoreSettings(organizationId: string) {
    const { data } = await this.db
      .from("store_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    return data;
  }

  async storeCatalog(organizationId: string, opts?: { categoryId?: string; brandId?: string }) {
    let q = this.db
      .from("products")
      .select(
        "id,sku,name,brand_id,category_id,model_id,retail_price,warranty_days,short_description,status",
      )
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(200);
    if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
    if (opts?.brandId) q = q.eq("brand_id", opts.brandId);
    const { data: products, error } = await q;
    if (error) throw new Error(error.message);
    return products ?? [];
  }

  async storeProductDetail(organizationId: string, productId: string) {
    const settings = await this.getStoreSettings(organizationId);
    const { data: product } = await this.db
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", productId)
      .maybeSingle();
    if (!product) throw new ValidationDomainError("Product not found");

    const [{ data: variants }, { data: media }, { data: specs }, { data: stock }] =
      await Promise.all([
        this.db
          .from("product_variants")
          .select("*")
          .eq("product_id", productId)
          .eq("organization_id", organizationId),
        this.db
          .from("product_media")
          .select("*")
          .eq("product_id", productId)
          .eq("organization_id", organizationId),
        this.db
          .from("product_specifications")
          .select("*")
          .eq("product_id", productId)
          .eq("organization_id", organizationId),
        settings
          ? this.db
              .from("stock_balances")
              .select("variant_id,qty_on_hand,qty_reserved")
              .eq("organization_id", organizationId)
              .eq("warehouse_id", str(settings.warehouse_id))
              .eq("product_id", productId)
          : Promise.resolve({ data: [] }),
      ]);

    const availability = ((stock ?? []) as Row[]).map((s) => ({
      variantId: s.variant_id ? str(s.variant_id) : null,
      available: Math.max(0, num(s.qty_on_hand) - num(s.qty_reserved)),
    }));

    return {
      product,
      variants: variants ?? [],
      media: media ?? [],
      specifications: specs ?? [],
      brandId: product.brand_id,
      modelId: product.model_id,
      price: product.retail_price,
      warrantyDays: product.warranty_days,
      stock: availability,
      images: ((media ?? []) as Row[]).filter((m) => str(m.media_type) === "image"),
      videos: ((media ?? []) as Row[]).filter((m) => str(m.media_type) === "video"),
    };
  }

  async storeCheckout(input: StoreCheckoutInput, userId?: string | null) {
    const settings = await this.getStoreSettings(input.organizationId);
    if (!settings || !settings.is_published) {
      throw new ValidationDomainError("Online store is not published");
    }

    const productIds = input.items.map((i) => i.productId);
    const { data: products } = await this.db
      .from("products")
      .select("id,retail_price,base_unit_id,name")
      .eq("organization_id", input.organizationId)
      .in("id", productIds);
    const productMap = new Map(((products ?? []) as Row[]).map((p) => [str(p.id), p]));

    const { data: balances } = await this.db
      .from("stock_balances")
      .select("product_id,variant_id,qty_on_hand,qty_reserved")
      .eq("organization_id", input.organizationId)
      .eq("warehouse_id", str(settings.warehouse_id))
      .in("product_id", productIds);

    assertStoreStock(
      input.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: Number(i.qty),
      })),
      ((balances ?? []) as Row[]).map((b) => ({
        productId: str(b.product_id),
        variantId: b.variant_id ? str(b.variant_id) : null,
        qtyOnHand: num(b.qty_on_hand),
        qtyReserved: num(b.qty_reserved),
      })),
    );

    const lines = input.items.map((i) => {
      const p = productMap.get(i.productId);
      if (!p) throw new ValidationDomainError(`Unknown product ${i.productId}`);
      return {
        productId: i.productId,
        variantId: i.variantId,
        unitId: i.unitId || str(p.base_unit_id),
        qty: i.qty,
        unitPrice: num(p.retail_price),
        discount: 0,
        tax: 0,
      };
    });

    const order = await this.afterSales.createSalesOrder(
      {
        organizationId: input.organizationId,
        branchId: str(settings.branch_id),
        warehouseId: str(settings.warehouse_id),
        customerId: input.customerId,
        items: lines,
        notes: buildOnlineOrderNotes(input),
        idempotencyKey: input.idempotencyKey,
        channel: "online",
        approvalStatus: "none",
        priceBook: "retail",
      },
      userId,
    );

    // Confirm online orders immediately into ERP pipeline
    await this.db
      .from("sales_orders")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    for (const i of lines) {
      await this.db.from("stock_reservations").insert({
        organization_id: input.organizationId,
        branch_id: str(settings.branch_id),
        warehouse_id: str(settings.warehouse_id),
        product_id: i.productId,
        variant_id: i.variantId ?? null,
        unit_id: i.unitId,
        qty: Number(i.qty),
        source_type: "order",
        source_id: order.id,
        status: "active",
      });
    }

    if (input.customerId) {
      const total = lines.reduce((a, l) => a + Number(l.qty) * Number(l.unitPrice), 0);
      await this.earnPoints(
        {
          organizationId: input.organizationId,
          customerId: input.customerId,
          purchaseAmount: total,
          sourceType: "online_order",
          sourceId: order.id,
        },
        userId,
      );
    }

    return { order, channel: "online", reserved: true };
  }
}
