import {
  getFilteredRowModel,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useState } from "react";

import { cn } from "../../lib/utils";

export function DataTable({
  columns,
  data,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  manualSorting = false,
  emptyText = "No rows found.",
  className,
  density = "comfortable",
  getRowId,
  onRowClick,
  rowClassName,
  enableColumnFilters = false,
}) {
  const [columnFilters, setColumnFilters] = useState([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      ...(sorting ? { sorting } : {}),
      ...(columnVisibility ? { columnVisibility } : {}),
      ...(enableColumnFilters ? { columnFilters } : {}),
    },
    onSortingChange,
    onColumnVisibilityChange,
    onColumnFiltersChange: enableColumnFilters ? setColumnFilters : undefined,
    manualSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: enableColumnFilters ? getFilteredRowModel() : undefined,
  });

  const cellPadding = density === "compact" ? "px-2 py-1.5" : "px-3 py-2.5";
  const headerPadding = density === "compact" ? "px-2 py-1.5" : "px-3 py-2";

  return (
    <div className={cn("overflow-auto rounded-xl border border-border bg-card", className)}>
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          {table.getHeaderGroups().map((headerGroup) => (
            <Fragment key={headerGroup.id}>
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={cn(headerPadding, "text-left align-top font-semibold")}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
              {enableColumnFilters ? (
                <tr key={`${headerGroup.id}-filters`} className="border-t border-border bg-muted/70">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta || {};
                    const filterVariant = meta.filterVariant || "text";
                    const filterOptions = meta.filterOptions || [];
                    const isFilterable = Boolean(meta.filterVariant);
                    if (!header.column.getCanFilter() || !isFilterable) {
                      return <th key={`${header.id}-filter`} className={cn(headerPadding, "text-left")} />;
                    }
                    if (filterVariant === "select") {
                      return (
                        <th key={`${header.id}-filter`} className={cn(headerPadding, "text-left")}>
                          <select
                            className="h-8 w-full rounded border border-input bg-white px-2 text-xs"
                            value={header.column.getFilterValue() ?? ""}
                            onChange={(event) =>
                              header.column.setFilterValue(event.target.value || undefined)
                            }
                          >
                            <option value="">All</option>
                            {filterOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </th>
                      );
                    }
                    return (
                      <th key={`${header.id}-filter`} className={cn(headerPadding, "text-left")}>
                        <input
                          type="text"
                          className="h-8 w-full rounded border border-input bg-white px-2 text-xs"
                          value={header.column.getFilterValue() ?? ""}
                          onChange={(event) => header.column.setFilterValue(event.target.value)}
                          placeholder="Filter..."
                        />
                      </th>
                    );
                  })}
                </tr>
              ) : null}
            </Fragment>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-border align-top transition hover:bg-muted/35",
                  onRowClick ? "cursor-pointer" : "",
                  typeof rowClassName === "function" ? rowClassName(row.original) : rowClassName
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cellPadding}>
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
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
        {sorted === "asc" ? "asc" : sorted === "desc" ? "desc" : "sort"}
      </span>
    </button>
  );
}
