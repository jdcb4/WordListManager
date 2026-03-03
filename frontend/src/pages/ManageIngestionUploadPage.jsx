import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { StatusChip } from "../components/ui/status-chip";
import { apiGet, apiPostForm } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageIngestionUploadPage() {
  const { runJob } = useJobTracker();
  const [stats, setStats] = useState(null);
  const [stagingSnapshot, setStagingSnapshot] = useState({ batches: [] });
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");

  async function refresh() {
    try {
      const [statsData, stagingData] = await Promise.all([
        apiGet("/api/v1/stats"),
        apiGet("/api/v1/manage/staging?limit=100"),
      ]);
      setStats(statsData);
      setStagingSnapshot(stagingData);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function uploadToStaging(event) {
    event.preventDefault();
    if (!uploadFile) {
      setMessage("Choose a CSV or JSON file to upload.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("note", uploadNote);
      const result = await runJob({
        title: "Ingestion: Upload file",
        description: uploadFile.name,
        source: "/manage/ingestion/upload",
        task: ({ signal }) => apiPostForm("/api/v1/manage/staging/upload", formData, { signal }),
      });
      setMessage(`Uploaded batch #${result.batch_id} with ${result.total_rows} rows.`);
      setUploadFile(null);
      setUploadNote("");
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUploading(false);
    }
  }

  const batchColumns = [
    columnHelper.accessor("id", { header: "Batch #" }),
    columnHelper.accessor("source_filename", { header: "Source", meta: { filterVariant: "text" } }),
    columnHelper.accessor("status", {
      header: "Status",
      meta: { filterVariant: "select", filterOptions: ["pending", "in_review", "completed"] },
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

  const totalBatches = useMemo(() => (stagingSnapshot?.batches || []).length, [stagingSnapshot]);

  return (
    <ManagementPageLayout
      title="Ingestion: Upload Files"
      description="Upload CSV or JSON sources into staging. Review and approve in Staging Review before publish."
      jobsSource="/manage/ingestion/upload"
      primaryAction={
        <a
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          href="/manage/ingestion/generate"
        >
          Go To AI Generate
        </a>
      }
      secondaryActions={
        <>
          <Button variant="outline" onClick={refresh} disabled={uploading}>
            Refresh
          </Button>
          <a
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm"
            href="/manage/staging"
          >
            Open Staging Review
          </a>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Active words: {stats?.total_active_words ?? "..."}
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Dataset version: {stats?.dataset_version ?? "..."}
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Recent batches: {totalBatches}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">Upload CSV/JSON</h2>
          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={uploadToStaging}>
            <input
              type="file"
              accept=".csv,.json"
              aria-label="Upload CSV or JSON file"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              className="h-9 rounded border border-input bg-white px-2 text-sm"
            />
            <Input
              value={uploadNote}
              aria-label="Upload note"
              onChange={(event) => setUploadNote(event.target.value)}
              placeholder="Upload note"
            />
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload To Staging"}
            </Button>
          </form>
          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Supported formats: CSV, JSON. Uploaded rows are always queued in staging."}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">Recent Batches</h2>
          {!stagingSnapshot?.batches?.length ? (
            <EmptyState
              title="No ingestion batches yet"
              description="Upload a file to create your first batch."
            />
          ) : (
            <DataTable
              columns={batchColumns}
              data={stagingSnapshot.batches}
              density="compact"
              enableColumnFilters
              emptyText="No batches found."
            />
          )}
        </CardContent>
      </Card>
    </ManagementPageLayout>
  );
}
