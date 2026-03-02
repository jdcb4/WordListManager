import { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
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
    <div className="space-y-4">
      <PageHeader
        title="Jobs"
        description="Track background jobs and cancel running jobs when needed."
        primaryAction={
          <Button variant="outline" onClick={clearFinishedJobs}>
            Clear finished
          </Button>
        }
      />

      <ManageTabs active="jobs" />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            {["all", "running", "success", "cancelled", "error"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </Button>
            ))}
          </div>
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
    </div>
  );
}

