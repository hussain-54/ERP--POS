import { useMemo, useState, type ReactNode } from "react";
import { Table, TBody, TD, TH, THead, TR } from "./Table.js";
import { EmptyState } from "./EmptyState.js";
import { LoadingState } from "./LoadingState.js";
import { Pagination } from "./Pagination.js";
import { SearchInput } from "./SearchInput.js";
import { Button } from "./Button.js";
import { Dropdown } from "./Dropdown.js";
import { cn } from "../lib/cn.js";

export interface DataColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  filterValue?: (row: T) => string;
  hideable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}

export type DataTableLayout = "auto" | "table" | "cards";

export const DATA_TABLE_CARD_COLUMN_LIMIT = 5;

export function shouldUseMobileTableCards(
  columnCount: number,
  layout: DataTableLayout = "auto",
): boolean {
  if (layout === "cards") return true;
  if (layout === "table") return false;
  return columnCount <= DATA_TABLE_CARD_COLUMN_LIMIT;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  columnVisibility?: boolean;
  rowActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** auto: stacked cards on mobile when the table is simple; table: always scroll. */
  layout?: DataTableLayout;
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "No records",
  emptyDescription = "There is nothing to show yet.",
  searchable = false,
  searchPlaceholder = "Filter rows…",
  pageSize,
  columnVisibility = false,
  rowActions,
  onRowClick,
  layout = "auto",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.has(column.key)),
    [columns, hidden],
  );

  const stackedOnMobile = shouldUseMobileTableCards(visibleColumns.length, layout);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((column) => {
        const value = column.filterValue?.(row) ?? (column.sortValue ? String(column.sortValue(row) ?? "") : "");
        return value.toLowerCase().includes(q);
      }),
    );
  }, [columns, query, rows]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const result = compareValues(column.sortValue?.(a), column.sortValue?.(b));
      return sortDir === "asc" ? result : -result;
    });
    return copy;
  }, [columns, filtered, sortDir, sortKey]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const paged = pageSize ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return <LoadingState label="Loading records…" />;

  const toolbar = searchable || columnVisibility;

  return (
    <div className="space-y-2">
      {toolbar ? (
        <div className="erp-filter-bar">
          {searchable ? (
            <div className="min-w-[12rem] flex-1">
              <SearchInput
                aria-label="Filter rows"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          ) : null}
          {columnVisibility ? (
            <Dropdown
              align="right"
              trigger={
                <Button type="button" variant="secondary" size="sm" className="min-h-11 lg:min-h-8">
                  Columns
                </Button>
              }
              items={columns
                .filter((column) => column.hideable !== false && column.header)
                .map((column) => ({
                  id: column.key,
                  label: `${hidden.has(column.key) ? "Show" : "Hide"} ${column.header}`,
                  onSelect: () => toggleColumn(column.key),
                }))}
            />
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {stackedOnMobile ? (
            <ul className="space-y-2 md:hidden" data-erp-table-cards>
              {paged.map((row) => (
                <li key={rowKey(row)}>
                  <article
                    className={cn(
                      "rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3 shadow-[var(--erp-shadow)]",
                      onRowClick && "cursor-pointer active:bg-[var(--erp-brand-soft)]",
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    <dl className="space-y-1">
                      {visibleColumns.map((column) => (
                        <div
                          key={column.key}
                          className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--erp-border)] py-1 last:border-b-0"
                        >
                          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">
                            {column.header || column.key}
                          </dt>
                          <dd className={cn("text-sm text-[var(--erp-ink)]", column.align === "right" && "text-right")}>
                            {column.cell(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {rowActions ? (
                      <div className="mt-2 flex min-h-11 items-center justify-end" onClick={(event) => event.stopPropagation()}>
                        {rowActions(row)}
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          ) : null}
          <Table
            className={stackedOnMobile ? "hidden md:block" : undefined}
            data-erp-table-grid
          >
            <THead>
              <TR>
                {visibleColumns.map((column) => {
                  const sortable = Boolean(column.sortValue);
                  const active = sortKey === column.key;
                  return (
                    <TH key={column.key} className={cn(column.align === "right" && "text-right", column.className)}>
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1 hover:text-[var(--erp-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:text-[var(--erp-ink)] lg:min-h-0"
                          onClick={() => toggleSort(column.key)}
                        >
                          {column.header}
                          <span aria-hidden className="text-[10px]">
                            {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      ) : (
                        column.header
                      )}
                    </TH>
                  );
                })}
                {rowActions ? <TH className="text-right">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {paged.map((row) => (
                <TR key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                  {visibleColumns.map((column) => (
                    <TD
                      key={column.key}
                      className={cn(column.align === "right" && "text-right", column.className)}
                    >
                      {column.cell(row)}
                    </TD>
                  ))}
                  {rowActions ? (
                    <TD className="text-right" onClick={(event) => event.stopPropagation()}>
                      {rowActions(row)}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {pageSize && sorted.length > 0 ? (
        <Pagination page={currentPage} pageSize={pageSize} total={sorted.length} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
