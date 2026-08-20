import { z } from "zod";
import { AuditedFieldsSchema, MoneySchema, UuidSchema } from "./common.js";
import { DecimalStringSchema, PositiveDecimalStringSchema } from "./decimal.js";

const NamedMasterBase = {
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  nameUr: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
};

export const CreateCategorySchema = z.object({
  ...NamedMasterBase,
  description: z.string().max(1000).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const CategorySchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CreateSubcategorySchema = z.object({
  ...NamedMasterBase,
  categoryId: UuidSchema,
  description: z.string().max(1000).optional(),
});
export type CreateSubcategoryInput = z.infer<typeof CreateSubcategorySchema>;

export const CreateBrandSchema = z.object(NamedMasterBase);
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;

export const CreateCompanySchema = z.object(NamedMasterBase);
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const CreateProductTypeSchema = z.object(NamedMasterBase);
export type CreateProductTypeInput = z.infer<typeof CreateProductTypeSchema>;

export const CreateProductModelSchema = z.object({
  ...NamedMasterBase,
  brandId: UuidSchema.optional(),
  companyId: UuidSchema.optional(),
});
export type CreateProductModelInput = z.infer<typeof CreateProductModelSchema>;

export const SYSTEM_UNITS = [
  "PIECE",
  "METER",
  "FOOT",
  "ROLL",
  "COIL",
  "BOX",
  "PACK",
  "BUNDLE",
  "KG",
  "GRAM",
  "SET",
  "PAIR",
  "UNIT",
  "LITER",
] as const;

export const CreateUnitSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  symbolPlaces: z.number().int().min(0).max(4).default(0),
  isActive: z.boolean().default(true),
});
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;

export const UnitSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string(),
  name: z.string(),
  symbolPlaces: z.number().int(),
  isBase: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
});
export type Unit = z.infer<typeof UnitSchema>;

export const CreateUnitConversionSchema = z.object({
  organizationId: UuidSchema,
  productId: UuidSchema.optional(),
  fromUnitId: UuidSchema,
  toUnitId: UuidSchema,
  factor: PositiveDecimalStringSchema,
});
export type CreateUnitConversionInput = z.infer<typeof CreateUnitConversionSchema>;

export const AttributeDataTypeSchema = z.enum(["text", "number", "boolean", "select"]);

export const CreateAttributeDefinitionSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  dataType: AttributeDataTypeSchema,
  unitLabel: z.string().max(32).optional(),
  options: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});
export type CreateAttributeDefinitionInput = z.infer<typeof CreateAttributeDefinitionSchema>;

export const ProductStatusSchema = z.enum(["draft", "active", "inactive"]);

export const ProductSpecificationsInputSchema = z.object({
  size: z.string().max(120).optional(),
  color: z.string().max(120).optional(),
  watt: DecimalStringSchema.optional(),
  voltage: DecimalStringSchema.optional(),
  ampere: DecimalStringSchema.optional(),
  length: DecimalStringSchema.optional(),
  width: DecimalStringSchema.optional(),
  height: DecimalStringSchema.optional(),
  material: z.string().max(120).optional(),
  gauge: z.string().max(64).optional(),
  phase: z.string().max(32).optional(),
  frequency: DecimalStringSchema.optional(),
  capacity: z.string().max(120).optional(),
  modelLabel: z.string().max(120).optional(),
  weight: DecimalStringSchema.optional(),
});

export const ProductAttributeValueSchema = z.object({
  attributeDefinitionId: UuidSchema,
  valueText: z.string().max(500).optional(),
  valueNumber: DecimalStringSchema.optional(),
  valueBoolean: z.boolean().optional(),
});

const OptionalUuidSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  UuidSchema.optional(),
);

const OptionalTrimmedSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(250).optional(),
);

export const CreateProductMasterSchema = z.object({
  organizationId: UuidSchema,
  productCode: z.string().trim().min(1, "Product code is required").max(64),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  name: z.string().trim().min(1, "Product name is required").max(250),
  nameUr: OptionalTrimmedSchema,
  shortDescription: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(500).optional(),
  ),
  description: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(5000).optional(),
  ),
  categoryId: OptionalUuidSchema,
  subcategoryId: OptionalUuidSchema,
  brandId: OptionalUuidSchema,
  companyId: OptionalUuidSchema,
  productTypeId: OptionalUuidSchema,
  modelId: OptionalUuidSchema,
  baseUnitId: UuidSchema,
  warrantyDays: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(true),
  trackSerial: z.boolean().default(false),
  trackBatch: z.boolean().default(false),
  reorderLevel: DecimalStringSchema.default("0"),
  status: ProductStatusSchema.default("active"),
  isActive: z.boolean().default(true),
  costPrice: MoneySchema.default(0),
  retailPrice: MoneySchema.default(0),
  wholesalePrice: MoneySchema.default(0),
  dealerPrice: MoneySchema.default(0),
  specialPrice: MoneySchema.optional(),
  minimumSalePrice: MoneySchema.default(0),
  primaryBarcode: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(64).optional(),
  ),
  specifications: ProductSpecificationsInputSchema.optional(),
  attributes: z.array(ProductAttributeValueSchema).default([]),
});
export type CreateProductMasterInput = z.input<typeof CreateProductMasterSchema>;

export const UpdateProductMasterSchema = CreateProductMasterSchema.partial().extend({
  organizationId: UuidSchema,
});
export type UpdateProductMasterInput = z.input<typeof UpdateProductMasterSchema>;

export const ProductMasterSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  productCode: z.string(),
  sku: z.string(),
  name: z.string(),
  nameUr: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  categoryId: UuidSchema.nullable().optional(),
  subcategoryId: UuidSchema.nullable().optional(),
  brandId: UuidSchema.nullable().optional(),
  companyId: UuidSchema.nullable().optional(),
  productTypeId: UuidSchema.nullable().optional(),
  modelId: UuidSchema.nullable().optional(),
  baseUnitId: UuidSchema,
  warrantyDays: z.number().int(),
  trackInventory: z.boolean(),
  trackSerial: z.boolean(),
  trackBatch: z.boolean(),
  reorderLevel: DecimalStringSchema,
  status: ProductStatusSchema,
  isActive: z.boolean(),
  costPrice: MoneySchema,
  retailPrice: MoneySchema,
  wholesalePrice: MoneySchema,
  dealerPrice: MoneySchema,
  specialPrice: MoneySchema.nullable().optional(),
  minimumSalePrice: MoneySchema,
  lastPurchasePrice: MoneySchema,
  averagePurchasePrice: MoneySchema,
  expectedProfit: MoneySchema.optional(),
  profitMarginPercent: z.number().optional(),
});
export type ProductMaster = z.infer<typeof ProductMasterSchema>;

export const CreateVariantSchema = z.object({
  organizationId: UuidSchema,
  productId: UuidSchema,
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  barcode: z.string().max(64).optional(),
  isActive: z.boolean().default(true),
});
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;

export const ProductListQuerySchema = z.object({
  q: z.string().optional(),
  categoryId: UuidSchema.optional(),
  brandId: UuidSchema.optional(),
  companyId: UuidSchema.optional(),
  status: ProductStatusSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  sortBy: z.enum(["name", "sku", "updatedAt", "retailPrice"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const BulkProductActionSchema = z.object({
  ids: z.array(UuidSchema).min(1),
  action: z.enum(["deactivate", "activate", "restore"]),
});
export type BulkProductActionInput = z.infer<typeof BulkProductActionSchema>;

export const ImportRowErrorSchema = z.object({
  row: z.number().int().positive(),
  field: z.string().optional(),
  message: z.string(),
});

export const ImportResultSchema = z.object({
  imported: z.number().int().min(0),
  failed: z.number().int().min(0),
  errors: z.array(ImportRowErrorSchema),
});
export type ImportResult = z.infer<typeof ImportResultSchema>;

export const GenerateBarcodeSchema = z.object({
  organizationId: UuidSchema,
  productId: UuidSchema,
  variantId: UuidSchema.optional(),
  codeType: z.enum(["ean13", "code128", "sku", "custom"]).default("code128"),
  code: z.string().max(64).optional(),
  isPrimary: z.boolean().default(false),
});
export type GenerateBarcodeInput = z.infer<typeof GenerateBarcodeSchema>;
