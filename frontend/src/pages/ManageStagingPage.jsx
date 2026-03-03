import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { BulkActionBar } from "../components/ui/bulk-action-bar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { SideDrawer } from "../components/ui/side-drawer";
import { StatusChip } from "../components/ui/status-chip";
import { TableToolbar } from "../components/ui/table-toolbar";
import { apiGet, apiPost } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageStagingPage() {
  const { runJob } = useJobTracker();
  const [staging, setStaging] = useState({ total: 0, results: [], batches: [] });
  const [stagingFilters, setStagingFilters] = useState({ status: "pending", batch_id: "", limit: 200 });
  const [selectedStagedIds, setSelectedStagedIds] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStagedId, setActiveStagedId] = useState(null);

  const rows = staging?.results || [];
  const activeRow = rows.find((row) => row.id === activeStagedId) || null;
  const batchStats = useMemo(() => {
    const batches = staging?.batches || [];
    const total = batches.length;
    const completed = batches.filter((batch) => batch.status === "completed").length;
    const inReview = batches.filter((batch) => batch.status === "in_review").length;
    const pending = batches.filter((batch) => batch.status === "pending").length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inReview, pending, percent };
  }, [staging]);

  async function refresh() {
    try {
      const params = new URLSearchParams();
      if (stagingFilters.status) params.set("status", stagingFilters.status);
      if (stagingFilters.batch_id) params.set("batch_id", stagingFilters.batch_id);
      params.set("limit", String(stagingFilters.limit || 200));
      const data = await apiGet(`/api/v1/manage/staging?${params.toString()}`);
      setStaging(data);
      setSelectedStagedIds([]);
      setActiveStagedId((current) =>
        data.results?.some((row) => row.id === current) ? current : null
      );
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, [stagingFilters.status, stagingFilters.batch_id, stagingFilters.limit]);

  useEffect(() => {
    function onKeyDown(event) {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(targetTag);
      if (isTyping) return;

      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (!rows.length) return;
        const currentIndex = rows.findIndex((row) => row.id === activeStagedId);
        const nextIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : currentIndex;
        setActiveStagedId(rows[nextIndex]?.id || activeStagedId);
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!rows.length) return;
        const currentIndex = rows.findIndex((row) => row.id === activeStagedId);
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        setActiveStagedId(rows[nextIndex]?.id || activeStagedId);
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        runStagingReview("approve");
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        runStagingReview("reject");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, activeStagedId, selectedStagedIds]);

  function toggleStagedSelect(id) {
    setSelectedStagedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAllStaged() {
    const ids = rows.map((row) => row.id).filter((value) => Number.isInteger(value));
    setSelectedStagedIds(Array.from(new Set(ids)));
  }

  function clearSelected() {
    setSelectedStagedIds([]);
  }

  async function runStagingReview(action) {
    const idsToReview = selectedStagedIds.length ? selectedStagedIds : activeStagedId ? [activeStagedId] : [];
    if (idsToReview.length === 0) return;

    setLoading(true);
    setMessage("");
    try {
      const data = await runJob({
        title: `Staging: ${action === "approve" ? "Approve" : "Reject"} rows`,
        description: `${idsToReview.length} selected row(s)`,
        source: "/manage/staging",
        task: ({ signal }) =>
          apiPost("/api/v1/manage/staging/review", {
            action,
            staged_word_ids: idsToReview,
            note: "",
          }, { signal }),
      });
      setMessage(`Action ${action} completed. Reviewed: ${data.reviewed}, skipped: ${data.skipped_non_pending}.`);
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    columnHelper.display({
      id: "select",
      header: () => <span>Select</span>,
      cell: (ctx) => (
        <input
          type="checkbox"
          checked={selectedStagedIds.includes(ctx.row.original.id)}
          aria-label={`Select staged row ${ctx.row.original.id}`}
          onChange={(event) => {
            event.stopPropagation();
            toggleStagedSelect(ctx.row.original.id);
          }}
        />
      ),
    }),
    columnHelper.accessor("word", {
      id: "word",
      header: "Word",
      meta: { filterVariant: "text" },
      cell: (ctx) => (
        <div>
          <div className="font-semibold">{ctx.row.original.word}</div>
          <div className="text-xs text-muted-foreground">
            {ctx.row.original.category || "-"} | {ctx.row.original.collection || "-"} | {ctx.row.original.difficulty || "-"}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor((row) => (row.preview.is_new ? "Create (New)" : "Update"), {
      id: "change_type",
      header: "Change",
      meta: { filterVariant: "select", filterOptions: ["Create (New)", "Update"] },
      cell: (ctx) => {
        const preview = ctx.row.original.preview;
        if (preview.is_new) return <StatusChip tone="success">Create (New)</StatusChip>;
        return <StatusChip tone="warning">Update ({preview.changed_fields.length} changes)</StatusChip>;
      },
    }),
    columnHelper.accessor((row) => `#${row.batch.id}`, {
      id: "batch",
      header: "Batch",
      meta: {
        filterVariant: "select",
        filterOptions: Array.from(new Set(rows.map((row) => `#${row.batch.id}`))),
      },
      cell: (ctx) => ctx.getValue(),
    }),
    columnHelper.accessor("created_at", {
      id: "created_at",
      header: "Queued",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
  ];

  return (
    <ManagementPageLayout
      title="Staging Review"
      description="Queue-style review for imported and AI-generated entries. Shortcuts: J/K move, A approve, R reject."
      jobsSource="/manage/staging"
      primaryAction={
        <Button onClick={() => runStagingReview("approve")} disabled={loading || (!selectedStagedIds.length && !activeStagedId)}>
          Approve
        </Button>
      }
      secondaryActions={
        <>
          <Button variant="destructive" onClick={() => runStagingReview("reject")} disabled={loading || (!selectedStagedIds.length && !activeStagedId)}>
            Reject
          </Button>
          <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
        </>
      }
    >
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Ingestion is handled in Upload Files and AI Generate. This page is review and decision only.
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">
                Batch progress: {batchStats.completed} of {batchStats.total || 0} batches completed
              </div>
              <div className="text-xs text-muted-foreground">
                Pending: {batchStats.pending} | In review: {batchStats.inReview}
              </div>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${batchStats.percent}%` }}
              />
            </div>
          </div>

          <TableToolbar
            left={
              <>
                {["pending", "approved", "rejected", ""].map((status) => (
                  <Button
                    key={status || "all"}
                    variant={stagingFilters.status === status ? "default" : "outline"}
                    onClick={() => setStagingFilters((prev) => ({ ...prev, status }))}
                  >
                    {status || "all"}
                  </Button>
                ))}
              </>
            }
            right={
              <>
                <select
                  className="h-9 rounded border border-input bg-white px-3 text-sm"
                  aria-label="Staging batch filter"
                  value={stagingFilters.batch_id}
                  onChange={(event) => setStagingFilters((prev) => ({ ...prev, batch_id: event.target.value }))}
                >
                  <option value="">all batches</option>
                  {(staging?.batches || []).map((batch) => (
                    <option key={batch.id} value={batch.id}>#{batch.id} {batch.source_filename}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={stagingFilters.limit}
                  aria-label="Staging row limit"
                  onChange={(event) => setStagingFilters((prev) => ({ ...prev, limit: Number(event.target.value || 200) }))}
                />
                <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                  Showing {rows.length} of {staging?.total || 0}
                </div>
              </>
            }
          />

          {!rows.length ? (
            <EmptyState title="No staged rows" description="Upload CSV/JSON or run AI generation to populate this queue." />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              density="compact"
              enableColumnFilters
              rowClassName={(row) => (row.id === activeStagedId ? "bg-sky-50" : "")}
              onRowClick={(row) => setActiveStagedId(row.id)}
            />
          )}

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Select rows for bulk action or use J/K/A/R shortcuts for fast queue review."}
          </div>
        </CardContent>
      </Card>

      <BulkActionBar selectedCount={selectedStagedIds.length}>
        <Button size="sm" onClick={selectAllStaged}>Select all rows</Button>
        <Button size="sm" variant="outline" onClick={clearSelected}>Clear selection</Button>
        <Button size="sm" onClick={() => runStagingReview("approve")} disabled={loading}>Approve selected</Button>
        <Button size="sm" variant="destructive" onClick={() => runStagingReview("reject")} disabled={loading}>Reject selected</Button>
      </BulkActionBar>

      <SideDrawer
        open={!!activeRow}
        onClose={() => setActiveStagedId(null)}
        title={activeRow?.word || "Staged word"}
        subtitle={activeRow ? `Batch #${activeRow.batch.id} | ${activeRow.preview.is_new ? "Create" : "Update"}` : ""}
      >
        {activeRow ? (
          <div className="space-y-3">
            {activeRow.preview.fields.map((fieldDiff) => (
              <div
                key={`${activeRow.id}-${fieldDiff.field}`}
                className={fieldDiff.changed ? "rounded-lg border border-amber-300 bg-amber-50 p-3" : "rounded-lg border border-border bg-white p-3"}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fieldDiff.field}</p>
                <div className="mt-1 text-sm">
                  <div><span className="text-muted-foreground">From:</span> {fieldDiff.from || "-"}</div>
                  <div><span className="text-muted-foreground">To:</span> {fieldDiff.to || "-"}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SideDrawer>
    </ManagementPageLayout>
  );
}
