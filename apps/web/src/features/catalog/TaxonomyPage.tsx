import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, Input, Tabs, useToast } from "@electronic-erp/ui";
import { catalogApi } from "./catalog-api";

const TABS = [
  { id: "categories", label: "Categories" },
  { id: "subcategories", label: "Subcategories" },
  { id: "brands", label: "Brands" },
  { id: "companies", label: "Companies" },
  { id: "product-types", label: "Product Types" },
  { id: "product-models", label: "Models" },
];

export function TaxonomyPage() {
  const toast = useToast();
  const [tab, setTab] = useState("categories");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");

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
      toast.push({ title: "Created", tone: "success" });
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
      <h1 className="text-2xl font-semibold">Catalog taxonomy</h1>
      <Tabs items={TABS} value={tab} onChange={setTab} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title={`New ${tab}`}>
          <Form onSubmit={onCreate}>
            <Input label="Code" required value={code} onChange={(e) => setCode(e.target.value)} />
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            {tab === "subcategories" ? (
              <Input
                label="Category ID"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                hint="Paste category UUID"
              />
            ) : null}
            <Button type="submit">Create</Button>
          </Form>
        </Card>
        <Card title="Records">
          <ul className="divide-y divide-[var(--erp-border)]">
            {items.map((item) => (
              <li key={String(item.id)} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <strong>{String(item.code)}</strong> — {String(item.name)}
                  <span className="ml-2 text-[var(--erp-muted)]">
                    {item.deleted_at ? "deleted" : item.is_active ? "active" : "inactive"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void catalogApi
                        .updateTaxonomy(tab, String(item.id), {
                          name: `${String(item.name)}`,
                        })
                        .then(() => load())
                    }
                  >
                    Edit
                  </Button>
                  {item.deleted_at ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void catalogApi.restoreTaxonomy(tab, String(item.id)).then(() => load())
                      }
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        void catalogApi.deactivateTaxonomy(tab, String(item.id)).then(() => load())
                      }
                    >
                      Deactivate
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
