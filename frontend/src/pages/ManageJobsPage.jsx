import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { StatusChip } from "../components/ui/status-chip";
import { TableToolbar } from "../components/ui/table-toolbar";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageJobsPage() {
  const { jobs, cancelJob, dismissJob, clearFinishedJobs } = useJobTracker();
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredJobs = useMemo(
    () => (statusFilter === "all" ? jobs : jobs.filter((job) => job.status === statusFilter)),
    [jobs, statusFilter]
  );

  const columns = [
    columnHelper.accessor("title", { header: "Job", meta: { filterVariant: "text" } }),
    columnHelper.accessor("source", { header: "Source", meta: { filterVariant: "text" } }),
    columnHelper.accessor("status", {
      header: "Status",
      meta: { filterVariant: "select", filterOptions: ["running", "success", "cancelled", "error"] },
      cell: (ctx) => {
        const status = ctx.getValue();
        const tone =
          status === "running"
            ? "info"
            : status === "success"
              ? "success"
              : status === "cancelled"
                ? "warning"
                : status === "error"
                  ? "danger"
                  : "neutral";
        return <StatusChip tone={tone}>{status}</StatusChip>;
      },
    }),
    columnHelper.accessor("startedAt", {
      header: "Started",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
    columnHelper.accessor("endedAt", {
      header: "Ended",
      cell: (ctx) => (ctx.getValue() ? new Date(ctx.getValue()).toLocaleString() : "-"),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (ctx) =>
        ctx.row.original.status === "running" ? (
          <Button size="sm" variant="outline" onClick={() => cancelJob(ctx.row.original.id)}>
            Cancel
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => dismissJob(ctx.row.original.id)}>
            Dismiss
          </Button>
        ),
    }),
  ];

  return (
    <ManagementPageLayout
      title="Jobs"
      description="Track background jobs and cancel running jobs when needed."
      primaryAction={
        <Button variant="outline" onClick={clearFinishedJobs}>
          Clear finished
        </Button>
      }
    >
      <Card>
        <CardContent className="space-y-3 pt-4">
          <TableToolbar
            left={
              <>
                {["all", "running", "success", "cancelled", "error"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </Button>
                ))}
              </>
            }
            right={
              <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                Showing {filteredJobs.length} of {jobs.length}
              </div>
            }
          />
          {!filteredJobs.length ? (
            <EmptyState title="No tracked jobs" description="Run a task from management pages to populate this list." />
          ) : (
            <DataTable
              columns={columns}
              data={filteredJobs}
              density="compact"
              enableColumnFilters
              emptyText="No jobs match this filter."
            />
          )}
        </CardContent>
      </Card>
    </ManagementPageLayout>
  );
}
