import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Breadcrumb, Button, Card, Form, FormActions, Input, PageHeader, Tabs, useToast } from "@electronic-erp/ui";
import { catalogApi } from "./catalog-api";

const TABS = [
  { id: "categories", label: "Categories" },
  { id: "subcategories", label: "Subcategories" },
  { id: "brands", label: "Brands" },
  { id: "companies", label: "Companies" },
  { id: "product-types", label: "Product Types" },
  { id: "product-models", label: "Models" },
];

const TAB_FROM_PATH: Record<string, string> = {
  "/categories": "categories",
  "/subcategories": "subcategories",
  "/brands": "brands",
  "/companies": "companies",
};

export function TaxonomyPage() {
  const toast = useToast();
  const { pathname } = useLocation();
  const fromPath = TAB_FROM_PATH[pathname] ?? "categories";
  const [tab, setTab] = useState(fromPath);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    setTab(fromPath);
  }, [fromPath]);

  async function load(entity = tab) {
    const res = await catalogApi.listTaxonomy(entity);
    setItems(res.items);
  }

  useEffect(() => {
    void load(tab).catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [tab, toast]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = { code, name };
      if (tab === "subcategories") body.categoryId = categoryId;
      await catalogApi.createTaxonomy(tab, body);
      setCode("");
      setName("");
      toast.push({ title: "Taxonomy record created", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Products", href: "/products" },
          { label: "Catalog Taxonomy" },
        ]}
      />

      <PageHeader
        moduleNumber="02"
        title="Catalog Taxonomy & Classifications"
        description="Organize your electronics catalog across categories, subcategories, brands, manufacturers, product types, and models."
      />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title={`Add New ${TABS.find((t) => t.id === tab)?.label.slice(0, -1) || "Item"}`} description="Define a new taxonomy attribute." divided className="lg:col-span-1">
          <Form onSubmit={onCreate} className="space-y-3">
            <Input
              label="Code / Slug"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ELEC-AC"
              required
            />
            <Input
              label="Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Air Conditioners"
              required
            />
            {tab === "subcategories" ? (
              <Input
                label="Parent Category ID"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="Parent Category UUID"
                required
              />
            ) : null}
            <FormActions>
              <Button type="submit">Create Record</Button>
            </FormActions>
          </Form>
        </Card>

        <Card title={`Existing ${TABS.find((t) => t.id === tab)?.label || "Items"} (${items.length})`} description="List of configured classifications in this category." divided className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {items.map((it) => (
              <div
                key={String(it.id)}
                className="flex flex-col justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs hover:border-blue-300 transition"
              >
                <div>
                  <p className="font-bold text-slate-900">{String(it.name)}</p>
                  <p className="font-mono text-[11px] text-slate-500">{String(it.code)}</p>
                </div>
                {it.category_id ? (
                  <span className="mt-2 text-[10px] text-blue-600 font-mono truncate">
                    Parent: {String(it.category_id).slice(0, 8)}…
                  </span>
                ) : null}
              </div>
            ))}
            {items.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-slate-400">
                No taxonomy records in this section yet.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
