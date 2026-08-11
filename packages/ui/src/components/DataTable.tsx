import type { ReactNode } from "react";
import { Table, TBody, TD, TH, THead, TR } from "./Table.js";
import { EmptyState } from "./EmptyState.js";
import { LoadingState } from "./LoadingState.js";

export interface DataColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "No records",
  emptyDescription = "There is nothing to show yet.",
}: DataTableProps<T>) {
  if (loading) return <LoadingState label="Loading records…" />;
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <Table>
      <THead>
        <TR>
          {columns.map((col) => (
            <TH key={col.key}>{col.header}</TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={rowKey(row)}>
            {columns.map((col) => (
              <TD key={col.key}>{col.cell(row)}</TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
