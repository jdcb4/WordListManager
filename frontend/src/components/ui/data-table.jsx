import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "../../lib/utils";

export function DataTable({
  columns,
  data,
  sorting,
  onSortingChange,
  manualSorting = false,
  emptyText = "No rows found.",
  className,
}) {
  const table = useReactTable({
    data,
    columns,
    state: sorting ? { sorting } : {},
    onSortingChange,
    manualSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
  });

  return (
    <div className={cn("overflow-auto rounded-xl border border-border bg-white", className)}>
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-2 py-2 text-left align-top font-semibold">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SortableHeader({ title, column, onToggle }) {
  const sorted = column?.getIsSorted?.() || false;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-left text-sm hover:bg-white/70"
      onClick={onToggle || (() => column?.toggleSorting?.(sorted === "asc"))}
    >
      <span>{title}</span>
      <span className="text-xs text-muted-foreground">
        {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}
      </span>
    </button>
  );
}
