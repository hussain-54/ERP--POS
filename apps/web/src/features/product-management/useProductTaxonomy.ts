import { useCallback, useEffect, useState } from "react";
import { catalogApi } from "./catalog-api";
import {
  mapSubcategoryOptions,
  mapTaxonomyOptions,
  slugTaxonomyCode,
  type SubcategoryOption,
  type TaxonomyOption,
} from "./product-form-state";

type InlineTaxonomy = "categories" | "companies" | "brands";

export function useProductTaxonomy() {
  const [units, setUnits] = useState<TaxonomyOption[]>([]);
  const [categories, setCategories] = useState<TaxonomyOption[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [brands, setBrands] = useState<TaxonomyOption[]>([]);
  const [companies, setCompanies] = useState<TaxonomyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [u, c, s, b, co] = await Promise.all([
      catalogApi.listTaxonomy("units"),
      catalogApi.listTaxonomy("categories"),
      catalogApi.listTaxonomy("subcategories"),
      catalogApi.listTaxonomy("brands"),
      catalogApi.listTaxonomy("companies"),
    ]);
    setUnits(mapTaxonomyOptions(u.items));
    setCategories(mapTaxonomyOptions(c.items));
    setSubcategories(mapSubcategoryOptions(s.items));
    setBrands(mapTaxonomyOptions(b.items));
    setCompanies(mapTaxonomyOptions(co.items));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadAll();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load taxonomy");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const createTaxonomy = useCallback(
    async (entity: InlineTaxonomy, name: string, code?: string) => {
      const created = (await catalogApi.createTaxonomy(entity, {
        code: (code?.trim() || slugTaxonomyCode(name)).toUpperCase(),
        name: name.trim(),
      })) as { id?: string };
      const res = await catalogApi.listTaxonomy(entity);
      const options = mapTaxonomyOptions(res.items);
      if (entity === "categories") setCategories(options);
      if (entity === "companies") setCompanies(options);
      if (entity === "brands") setBrands(options);
      return created?.id;
    },
    [],
  );

  return { units, categories, subcategories, brands, companies, loading, error, createTaxonomy, reload: loadAll };
}
