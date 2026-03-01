import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { Badge } from "../components/ui/badge";
import { BulkActionBar } from "../components/ui/bulk-action-bar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { SideDrawer } from "../components/ui/side-drawer";
import { apiGet, apiPost, apiPostForm } from "../lib/http";

const columnHelper = createColumnHelper();

export function ManageStagingPage() {
  const [staging, setStaging] = useState({ total: 0, results: [], batches: [] });
  const [stagingFilters, setStagingFilters] = useState({ status: "pending", batch_id: "", limit: 200 });
  const [selectedStagedIds, setSelectedStagedIds] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeStagedId, setActiveStagedId] = useState(null);

  const rows = staging?.results || [];
  const activeRow = rows.find((row) => row.id === activeStagedId) || null;

  async function refresh() {
    try {
      const params = new URLSearchParams();
      if (stagingFilters.status) params.set("status", stagingFilters.status);
      if (stagingFilters.batch_id) params.set("batch_id", stagingFilters.batch_id);
      params.set("limit", String(stagingFilters.limit || 200));
      const data = await apiGet(`/api/v1/manage/staging?${params.toString()}`);
      setStaging(data);
      setSelectedStagedIds([]);
      setActiveStagedId(data.results?.[0]?.id || null);
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
      const data = await apiPost("/api/v1/manage/staging/review", {
        action,
        staged_word_ids: idsToReview,
        note: "",
      });
      setMessage(`Action ${action} completed. Reviewed: ${data.reviewed}, skipped: ${data.skipped_non_pending}.`);
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function uploadStagingFile(event) {
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
      const result = await apiPostForm("/api/v1/manage/staging/upload", formData);
      setMessage(`Uploaded batch #${result.batch_id} (${result.total_rows} rows).`);
      setUploadFile(null);
      setUploadNote("");
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUploading(false);
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
      cell: (ctx) => (
        <div>
          <div className="font-semibold">{ctx.row.original.word}</div>
          <div className="text-xs text-muted-foreground">
            {ctx.row.original.category || "-"} | {ctx.row.original.collection || "-"} | {ctx.row.original.difficulty || "-"}
          </div>
        </div>
      ),
    }),
    columnHelper.display({
      id: "change_type",
      header: "Change",
      cell: (ctx) => {
        const preview = ctx.row.original.preview;
        if (preview.is_new) return <Badge className="bg-emerald-100 text-emerald-800">Create (New)</Badge>;
        return <Badge className="bg-amber-100 text-amber-800">Update ({preview.changed_fields.length} changes)</Badge>;
      },
    }),
    columnHelper.display({
      id: "batch",
      header: "Batch",
      cell: (ctx) => `#${ctx.row.original.batch.id}`,
    }),
    columnHelper.accessor("created_at", {
      id: "created_at",
      header: "Queued",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staging Review"
        description="Queue-style review for imported and AI-generated entries. Shortcuts: J/K move, A approve, R reject."
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
      />

      <ManageTabs active="staging" />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" onSubmit={uploadStagingFile}>
            <input
              type="file"
              accept=".csv,.json"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              className="h-9 rounded border border-input bg-white px-2 text-sm"
            />
            <Input value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} placeholder="Upload note" />
            <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload to Staging"}</Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {["pending", "approved", "rejected", ""].map((status) => (
              <Button
                key={status || "all"}
                variant={stagingFilters.status === status ? "default" : "outline"}
                onClick={() => setStagingFilters((prev) => ({ ...prev, status }))}
              >
                {status || "all"}
              </Button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
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
              onChange={(event) => setStagingFilters((prev) => ({ ...prev, limit: Number(event.target.value || 200) }))}
            />
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Showing {rows.length} of {staging?.total || 0}
            </div>
          </div>

          {!rows.length ? (
            <EmptyState title="No staged rows" description="Upload CSV/JSON or run AI generation to populate this queue." />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              density="compact"
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
    </div>
  );
}
