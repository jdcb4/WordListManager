import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { StatusChip } from "../components/ui/status-chip";
import { TableToolbar } from "../components/ui/table-toolbar";
import { apiGet } from "../lib/http";

const columnHelper = createColumnHelper();

export function ManageIngestionBatchesPage() {
  const [stagingSnapshot, setStagingSnapshot] = useState({ batches: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceQuery, setSourceQuery] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiGet("/api/v1/manage/staging?limit=100");
      setStagingSnapshot(data);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const allBatches = stagingSnapshot?.batches || [];
  const filteredBatches = useMemo(() => {
    return allBatches.filter((batch) => {
      const matchesStatus = statusFilter === "all" ? true : batch.status === statusFilter;
      const matchesSource = sourceQuery
        ? batch.source_filename.toLowerCase().includes(sourceQuery.toLowerCase())
        : true;
      return matchesStatus && matchesSource;
    });
  }, [allBatches, statusFilter, sourceQuery]);

  const batchStatuses = useMemo(
    () => Array.from(new Set(allBatches.map((batch) => batch.status).filter(Boolean))),
    [allBatches]
  );

  const columns = [
    columnHelper.accessor("id", { header: "Batch #" }),
    columnHelper.accessor("source_filename", { header: "Source", meta: { filterVariant: "text" } }),
    columnHelper.accessor("status", {
      header: "Status",
      meta: { filterVariant: "select", filterOptions: batchStatuses },
      cell: (ctx) => {
        const status = ctx.getValue();
        const tone =
          status === "completed"
            ? "success"
            : status === "pending" || status === "in_review"
              ? "warning"
              : "neutral";
        return <StatusChip tone={tone}>{status}</StatusChip>;
      },
    }),
    columnHelper.accessor("total_rows", { header: "Rows" }),
    columnHelper.accessor("pending_count", { header: "Pending" }),
    columnHelper.accessor("approved_count", { header: "Approved" }),
    columnHelper.accessor("rejected_count", { header: "Rejected" }),
    columnHelper.accessor("created_at", {
      header: "Created",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
  ];

  return (
    <ManagementPageLayout
      title="Ingestion: Batch Monitor"
      description="Monitor imported/generated batches and review throughput before final staging actions."
      primaryAction={
        <a
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          href="/manage/ingestion/upload"
        >
          Upload Files
        </a>
      }
      secondaryActions={
        <>
          <a
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm"
            href="/manage/ingestion/generate"
          >
            AI Generate
          </a>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </>
      }
    >
      <Card>
        <CardContent className="space-y-3 pt-4">
          <TableToolbar
            left={
              <Input
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder="Filter by source filename"
                aria-label="Filter by source filename"
              />
            }
            right={
              <>
                <select
                  className="h-9 rounded border border-input bg-white px-3 text-sm"
                  aria-label="Batch status filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">all statuses</option>
                  {batchStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                  Showing {filteredBatches.length} of {allBatches.length}
                </div>
              </>
            }
          />

          {!filteredBatches.length ? (
            <EmptyState
              title="No batches for this filter"
              description="Adjust the status/source filter or upload a new batch."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredBatches}
              density="compact"
              enableColumnFilters
              emptyText="No batches found."
            />
          )}

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Use Staging Review for row-level approve/reject actions."}
          </div>
        </CardContent>
      </Card>
    </ManagementPageLayout>
  );
}
