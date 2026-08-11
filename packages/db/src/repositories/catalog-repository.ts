import type {
  CreateAttributeDefinitionInput,
  CreateBrandInput,
  CreateCategoryInput,
  CreateCompanyInput,
  CreateProductMasterInput,
  CreateProductModelInput,
  CreateProductTypeInput,
  CreateSubcategoryInput,
  CreateUnitConversionInput,
  CreateUnitInput,
  CreateVariantInput,
  GenerateBarcodeInput,
  ProductListQuery,
  ProductMaster,
  UpdateProductMasterInput,
} from "@electronic-erp/contracts";
import {
  barcodeFromSku,
  ean13FromSeed,
  expectedProfit,
  normalizeBarcode,
  profitMarginPercent,
  qrPayloadForProduct,
  validateConversionInput,
  validatePricing,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

export class CatalogRepository {
  constructor(private readonly db: DatabaseClient) {}

  // --- taxonomy helpers ---
  private async upsertNamed(
    table: string,
    input: { organizationId: string; code: string; name: string; nameUr?: string; isActive?: boolean; description?: string; categoryId?: string; brandId?: string; companyId?: string },
  ) {
    const payload: Row = {
      organization_id: input.organizationId,
      code: input.code,
      name: input.name,
      name_ur: input.nameUr ?? null,
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    };
    if (input.description !== undefined) payload.description = input.description;
    if (input.categoryId) payload.category_id = input.categoryId;
    if (input.brandId) payload.brand_id = input.brandId;
    if (input.companyId) payload.company_id = input.companyId;

    const { data, error } = await this.db.from(table).insert(payload).select("*").single();
    if (error) throw error;
    return data;
  }

  createCategory(input: CreateCategoryInput) {
    return this.upsertNamed("categories", input);
  }
  createSubcategory(input: CreateSubcategoryInput) {
    return this.upsertNamed("subcategories", input);
  }
  createBrand(input: CreateBrandInput) {
    return this.upsertNamed("brands", input);
  }
  createCompany(input: CreateCompanyInput) {
    return this.upsertNamed("companies", input);
  }
  createProductType(input: CreateProductTypeInput) {
    return this.upsertNamed("product_types", input);
  }
  createProductModel(input: CreateProductModelInput) {
    return this.upsertNamed("product_models", input);
  }

  async listTaxonomy(table: string, organizationId: string, includeDeleted = false) {
    let q = this.db.from(table).select("*").eq("organization_id", organizationId).order("name");
    if (!includeDeleted) q = q.is("deleted_at", null);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async softDelete(table: string, id: string) {
    const { data, error } = await this.db
      .from(table)
      .update({ deleted_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async restore(table: string, id: string) {
    const { data, error } = await this.db
      .from(table)
      .update({ deleted_at: null, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updateNamed(table: string, id: string, patch: Row) {
    const mapped: Row = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(patch)) {
      mapped[camelToSnake(k)] = v;
    }
    const { data, error } = await this.db.from(table).update(mapped).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  // --- units ---
  async createUnit(input: CreateUnitInput) {
    const { data, error } = await this.db
      .from("units")
      .insert({
        organization_id: input.organizationId,
        code: input.code.toUpperCase(),
        name: input.name,
        symbol_places: input.symbolPlaces,
        is_active: input.isActive,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async ensureSystemUnits(organizationId: string) {
    const system = [
      ["PIECE", "Piece", 0],
      ["METER", "Meter", 2],
      ["FOOT", "Foot", 2],
      ["ROLL", "Roll", 0],
      ["COIL", "Coil", 0],
      ["BOX", "Box", 0],
      ["PACK", "Pack", 0],
      ["BUNDLE", "Bundle", 0],
      ["KG", "Kg", 3],
      ["GRAM", "Gram", 2],
      ["SET", "Set", 0],
      ["PAIR", "Pair", 0],
      ["UNIT", "Unit", 0],
      ["LITER", "Liter", 3],
    ] as const;
    for (const [code, name, places] of system) {
      await this.db.from("units").upsert(
        {
          organization_id: organizationId,
          code,
          name,
          symbol_places: places,
          is_system: true,
          is_active: true,
        },
        { onConflict: "organization_id,code" },
      );
    }
  }

  async createUnitConversion(input: CreateUnitConversionInput) {
    validateConversionInput(input);
    const { data, error } = await this.db
      .from("unit_conversions")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId ?? null,
        from_unit_id: input.fromUnitId,
        to_unit_id: input.toUnitId,
        factor: input.factor,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listUnitConversions(organizationId: string, productId?: string) {
    let q = this.db
      .from("unit_conversions")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);
    if (productId) q = q.or(`product_id.eq.${productId},product_id.is.null`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async createAttributeDefinition(input: CreateAttributeDefinitionInput) {
    const { data, error } = await this.db
      .from("attribute_definitions")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        data_type: input.dataType,
        unit_label: input.unitLabel ?? null,
        options: input.options,
        is_active: input.isActive,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  // --- products ---
  async createProduct(input: CreateProductMasterInput): Promise<ProductMaster> {
    const costPrice = input.costPrice ?? 0;
    const retailPrice = input.retailPrice ?? 0;
    const wholesalePrice = input.wholesalePrice ?? 0;
    const dealerPrice = input.dealerPrice ?? 0;
    const minimumSalePrice = input.minimumSalePrice ?? 0;
    const attributes = input.attributes ?? [];

    validatePricing({
      costPrice,
      retailPrice,
      wholesalePrice,
      dealerPrice,
      specialPrice: input.specialPrice,
      minimumSalePrice,
      lastPurchasePrice: 0,
      averagePurchasePrice: 0,
    });

    const { data, error } = await this.db
      .from("products")
      .insert({
        organization_id: input.organizationId,
        product_code: input.productCode,
        sku: input.sku,
        name: input.name,
        name_ur: input.nameUr ?? null,
        short_description: input.shortDescription ?? null,
        description: input.description ?? null,
        category_id: input.categoryId ?? null,
        subcategory_id: input.subcategoryId ?? null,
        brand_id: input.brandId ?? null,
        company_id: input.companyId ?? null,
        product_type_id: input.productTypeId ?? null,
        model_id: input.modelId ?? null,
        base_unit_id: input.baseUnitId,
        warranty_days: input.warrantyDays ?? 0,
        track_inventory: input.trackInventory ?? true,
        track_serial: input.trackSerial ?? false,
        track_batch: input.trackBatch ?? false,
        reorder_level: input.reorderLevel ?? "0",
        status: input.status ?? "active",
        is_active: input.isActive ?? true,
        cost_price: costPrice,
        retail_price: retailPrice,
        wholesale_price: wholesalePrice,
        dealer_price: dealerPrice,
        special_price: input.specialPrice ?? null,
        minimum_sale_price: minimumSalePrice,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (input.specifications) {
      const s = input.specifications;
      await this.db.from("product_specifications").insert({
        organization_id: input.organizationId,
        product_id: data.id,
        size: s.size ?? null,
        color: s.color ?? null,
        watt: s.watt ?? null,
        voltage: s.voltage ?? null,
        ampere: s.ampere ?? null,
        length: s.length ?? null,
        width: s.width ?? null,
        height: s.height ?? null,
        material: s.material ?? null,
        gauge: s.gauge ?? null,
        phase: s.phase ?? null,
        frequency: s.frequency ?? null,
        capacity: s.capacity ?? null,
        model_label: s.modelLabel ?? null,
        weight: s.weight ?? null,
      });
    }

    for (const attr of attributes) {
      await this.db.from("product_attributes").insert({
        organization_id: input.organizationId,
        product_id: data.id,
        attribute_definition_id: attr.attributeDefinitionId,
        value_text: attr.valueText ?? null,
        value_number: attr.valueNumber ?? null,
        value_boolean: attr.valueBoolean ?? null,
      });
    }

    const barcode = input.primaryBarcode
      ? normalizeBarcode(input.primaryBarcode)
      : barcodeFromSku(input.sku);
    await this.db.from("barcodes").insert({
      organization_id: input.organizationId,
      product_id: data.id,
      code: barcode,
      code_type: input.primaryBarcode ? "custom" : "sku",
      is_primary: true,
    });
    await this.db.from("qr_codes").insert({
      organization_id: input.organizationId,
      product_id: data.id,
      payload: qrPayloadForProduct(String(data.id), input.sku),
    });

    return mapProduct(data);
  }

  async updateProduct(id: string, input: UpdateProductMasterInput): Promise<ProductMaster> {
    const patch: Row = { updated_at: new Date().toISOString() };
    const map: Record<string, string> = {
      productCode: "product_code",
      sku: "sku",
      name: "name",
      nameUr: "name_ur",
      shortDescription: "short_description",
      description: "description",
      categoryId: "category_id",
      subcategoryId: "subcategory_id",
      brandId: "brand_id",
      companyId: "company_id",
      productTypeId: "product_type_id",
      modelId: "model_id",
      baseUnitId: "base_unit_id",
      warrantyDays: "warranty_days",
      trackInventory: "track_inventory",
      trackSerial: "track_serial",
      trackBatch: "track_batch",
      reorderLevel: "reorder_level",
      status: "status",
      isActive: "is_active",
      costPrice: "cost_price",
      retailPrice: "retail_price",
      wholesalePrice: "wholesale_price",
      dealerPrice: "dealer_price",
      specialPrice: "special_price",
      minimumSalePrice: "minimum_sale_price",
    };
    for (const [k, col] of Object.entries(map)) {
      if (k in input && k !== "organizationId") {
        patch[col] = (input as Row)[k];
      }
    }
    const { data, error } = await this.db.from("products").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return mapProduct(data);
  }

  async getProduct(id: string): Promise<ProductMaster | null> {
    const { data, error } = await this.db.from("products").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapProduct(data) : null;
  }

  async listProducts(organizationId: string, query: ProductListQuery) {
    let q = this.db.from("products").select("*", { count: "exact" }).eq("organization_id", organizationId);
    if (!query.includeDeleted) q = q.is("deleted_at", null);
    if (query.q) q = q.or(`name.ilike.%${query.q}%,sku.ilike.%${query.q}%,product_code.ilike.%${query.q}%`);
    if (query.categoryId) q = q.eq("category_id", query.categoryId);
    if (query.brandId) q = q.eq("brand_id", query.brandId);
    if (query.companyId) q = q.eq("company_id", query.companyId);
    if (query.status) q = q.eq("status", query.status);
    if (query.isActive !== undefined) q = q.eq("is_active", query.isActive);

    const sortCol =
      query.sortBy === "updatedAt"
        ? "updated_at"
        : query.sortBy === "retailPrice"
          ? "retail_price"
          : query.sortBy;
    q = q.order(sortCol, { ascending: query.sortDir === "asc" });

    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    const { data, error, count } = await q.range(from, to);
    if (error) throw error;
    return {
      items: (data ?? []).map(mapProduct),
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async bulkAction(ids: string[], action: "deactivate" | "activate" | "restore") {
    const patch =
      action === "deactivate"
        ? { is_active: false, status: "inactive", updated_at: new Date().toISOString() }
        : action === "activate"
          ? { is_active: true, status: "active", deleted_at: null, updated_at: new Date().toISOString() }
          : { deleted_at: null, is_active: true, status: "active", updated_at: new Date().toISOString() };
    const { data, error } = await this.db.from("products").update(patch).in("id", ids).select("id");
    if (error) throw error;
    return { affected: data?.length ?? 0 };
  }

  async createVariant(input: CreateVariantInput) {
    const { data, error } = await this.db
      .from("product_variants")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        sku: input.sku,
        name: input.name,
        barcode: input.barcode ? normalizeBarcode(input.barcode) : null,
        is_active: input.isActive,
      })
      .select("*")
      .single();
    if (error) throw error;
    if (input.barcode) {
      await this.db.from("barcodes").insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        variant_id: data.id,
        code: normalizeBarcode(input.barcode),
        code_type: "custom",
        is_primary: false,
      });
    }
    return data;
  }

  async generateBarcode(input: GenerateBarcodeInput) {
    const product = await this.getProduct(input.productId);
    if (!product) throw new Error("Product not found");
    let code = input.code;
    if (!code) {
      if (input.codeType === "ean13") code = ean13FromSeed(product.sku + product.id.replace(/-/g, ""));
      else code = barcodeFromSku(product.sku);
    }
    code = normalizeBarcode(code);
    const { data, error } = await this.db
      .from("barcodes")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        code,
        code_type: input.codeType,
        is_primary: input.isPrimary,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async addMedia(input: {
    organizationId: string;
    productId: string;
    mediaType: string;
    storagePath: string;
    fileName: string;
    mimeType?: string;
    fileSize?: number;
    isPrimary?: boolean;
  }) {
    const { data, error } = await this.db
      .from("product_media")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        media_type: input.mediaType,
        storage_path: input.storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType ?? null,
        file_size: input.fileSize ?? null,
        is_primary: input.isPrimary ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listMedia(productId: string) {
    const { data, error } = await this.db
      .from("product_media")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  }

  async createPriceLevel(input: { organizationId: string; code: string; name: string }) {
    const { data, error } = await this.db
      .from("price_levels")
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listPriceLevels(organizationId: string) {
    const { data, error } = await this.db
      .from("price_levels")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  async setProductPrice(input: {
    organizationId: string;
    productId: string;
    unitId: string;
    amount: number;
    priceLevelId?: string;
    customerId?: string;
    variantId?: string;
    branchId?: string;
  }) {
    const { data, error } = await this.db
      .from("product_prices")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        unit_id: input.unitId,
        amount: input.amount,
        price_level_id: input.priceLevelId ?? null,
        customer_id: input.customerId ?? null,
        variant_id: input.variantId ?? null,
        branch_id: input.branchId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listProductPrices(productId: string) {
    const { data, error } = await this.db
      .from("product_prices")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listBarcodes(organizationId: string, productId?: string) {
    let q = this.db
      .from("barcodes")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (productId) q = q.eq("product_id", productId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async generateQr(input: { organizationId: string; productId: string; variantId?: string }) {
    const product = await this.getProduct(input.productId);
    if (!product) throw new Error("Product not found");
    const payload = qrPayloadForProduct(product.id, product.sku);
    const { data, error } = await this.db
      .from("qr_codes")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        payload,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async exportProducts(organizationId: string) {
    const { data, error } = await this.db
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return (data ?? []).map(mapProduct);
  }

  async updateProductPricesBySku(
    organizationId: string,
    sku: string,
    prices: {
      retailPrice?: number;
      wholesalePrice?: number;
      dealerPrice?: number;
      minimumSalePrice?: number;
    },
  ) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (prices.retailPrice != null) patch.retail_price = prices.retailPrice;
    if (prices.wholesalePrice != null) patch.wholesale_price = prices.wholesalePrice;
    if (prices.dealerPrice != null) patch.dealer_price = prices.dealerPrice;
    if (prices.minimumSalePrice != null) patch.minimum_sale_price = prices.minimumSalePrice;
    const { data, error } = await this.db
      .from("products")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("sku", sku)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Product sku not found: ${sku}`);
    return mapProduct(data);
  }
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function mapProduct(row: Row): ProductMaster {
  const pricing = {
    costPrice: Number(row.cost_price ?? 0),
    retailPrice: Number(row.retail_price ?? 0),
    wholesalePrice: Number(row.wholesale_price ?? 0),
    dealerPrice: Number(row.dealer_price ?? 0),
    specialPrice: row.special_price == null ? null : Number(row.special_price),
    minimumSalePrice: Number(row.minimum_sale_price ?? 0),
    lastPurchasePrice: Number(row.last_purchase_price ?? 0),
    averagePurchasePrice: Number(row.average_purchase_price ?? 0),
  };
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    productCode: String(row.product_code),
    sku: String(row.sku),
    name: String(row.name),
    nameUr: (row.name_ur as string | null) ?? null,
    shortDescription: (row.short_description as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    categoryId: (row.category_id as string | null) ?? null,
    subcategoryId: (row.subcategory_id as string | null) ?? null,
    brandId: (row.brand_id as string | null) ?? null,
    companyId: (row.company_id as string | null) ?? null,
    productTypeId: (row.product_type_id as string | null) ?? null,
    modelId: (row.model_id as string | null) ?? null,
    baseUnitId: String(row.base_unit_id),
    warrantyDays: Number(row.warranty_days ?? 0),
    trackInventory: Boolean(row.track_inventory),
    trackSerial: Boolean(row.track_serial),
    trackBatch: Boolean(row.track_batch),
    reorderLevel: String(row.reorder_level ?? "0"),
    status: row.status as ProductMaster["status"],
    isActive: Boolean(row.is_active),
    ...pricing,
    expectedProfit: expectedProfit(pricing),
    profitMarginPercent: profitMarginPercent(pricing),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
    version: Number(row.version ?? 1),
  };
}
