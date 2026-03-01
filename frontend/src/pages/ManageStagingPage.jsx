import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { Input } from "../components/ui/input";
import { apiGet, apiPost, apiPostForm } from "../lib/http";

const columnHelper = createColumnHelper();

export function ManageStagingPage() {
  const [staging, setStaging] = useState({ total: 0, results: [], batches: [] });
  const [stagingFilters, setStagingFilters] = useState({ status: "pending", batch_id: "", limit: 200 });
  const [selectedStagedIds, setSelectedStagedIds] = useState([]);
  const [expandedStagedRows, setExpandedStagedRows] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const rows = staging?.results || [];

  async function refresh() {
    try {
      const params = new URLSearchParams();
      if (stagingFilters.status) params.set("status", stagingFilters.status);
      if (stagingFilters.batch_id) params.set("batch_id", stagingFilters.batch_id);
      params.set("limit", String(stagingFilters.limit || 200));
      const data = await apiGet(`/api/v1/manage/staging?${params.toString()}`);
      setStaging(data);
      setSelectedStagedIds([]);
      setExpandedStagedRows([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, [stagingFilters.status, stagingFilters.batch_id, stagingFilters.limit]);

  function toggleStagedSelect(id) {
    setSelectedStagedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAllStaged() {
    const ids = rows.map((row) => row.id).filter((value) => Number.isInteger(value));
    setSelectedStagedIds(Array.from(new Set(ids)));
  }

  function toggleStagedDiff(id) {
    setExpandedStagedRows((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  async function runStagingReview(action) {
    if (selectedStagedIds.length === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost("/api/v1/manage/staging/review", {
        action,
        staged_word_ids: selectedStagedIds,
        note: "",
      });
      setMessage(JSON.stringify(data));
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
      setMessage(`Uploaded staging batch ${result.batch_id} with ${result.total_rows} row(s).`);
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
          onChange={() => toggleStagedSelect(ctx.row.original.id)}
        />
      ),
    }),
    columnHelper.accessor("word", {
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
    columnHelper.accessor("word_type", {
      header: "Type",
    }),
    columnHelper.display({
      id: "batch",
      header: "Batch",
      cell: (ctx) => `#${ctx.row.original.batch.id}`,
    }),
    columnHelper.display({
      id: "preview",
      header: "Preview",
      cell: (ctx) => (
        <span className={ctx.row.original.preview.is_new ? "rounded bg-green-100 px-2 py-1 text-xs text-green-700" : "rounded bg-amber-100 px-2 py-1 text-xs text-amber-700"}>
          {ctx.row.original.preview.is_new ? "Create New" : "Update Existing"}
        </span>
      ),
    }),
    columnHelper.display({
      id: "changed",
      header: "Changed Components",
      cell: (ctx) => (
        <div className="flex flex-wrap gap-1">
          {ctx.row.original.preview.changed_fields.length === 0 ? (
            <span className="text-xs text-muted-foreground">No changes</span>
          ) : (
            ctx.row.original.preview.changed_fields.map((field) => (
              <span key={`${ctx.row.original.id}-${field}`} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                {field}
              </span>
            ))
          )}
        </div>
      ),
    }),
    columnHelper.display({
      id: "details",
      header: "Details",
      cell: (ctx) => (
        <div>
          <Button variant="outline" onClick={() => toggleStagedDiff(ctx.row.original.id)}>
            {expandedStagedRows.includes(ctx.row.original.id) ? "Hide" : "View"}
          </Button>
          {expandedStagedRows.includes(ctx.row.original.id) ? (
            <div className="mt-2 rounded border border-border bg-slate-50 p-2 text-xs">
              {ctx.row.original.preview.fields.map((fieldDiff) => (
                <div key={`${ctx.row.original.id}-${fieldDiff.field}`} className={fieldDiff.changed ? "mb-1 rounded bg-amber-50 p-1" : "mb-1 p-1"}>
                  <strong>{fieldDiff.field}:</strong> {fieldDiff.from || "-"} {" -> "} {fieldDiff.to || "-"}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ),
    }),
  ];

  return (
    <div className="space-y-4">
      <ManageTabs active="staging" />
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-100 via-cyan-50 to-sky-100">
          <CardTitle>Staging Review</CardTitle>
        </CardHeader>
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

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              value={stagingFilters.status}
              onChange={(event) => setStagingFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="">all statuses</option>
            </select>
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
            <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAllStaged}>Select All</Button>
            <Button onClick={() => runStagingReview("approve")} disabled={loading || selectedStagedIds.length === 0}>Approve Selected</Button>
            <Button variant="destructive" onClick={() => runStagingReview("reject")} disabled={loading || selectedStagedIds.length === 0}>Reject Selected</Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {rows.length} of {staging?.total || 0} staged row(s).
          </div>
          <DataTable columns={columns} data={rows} emptyText="No staged rows found." />

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Staging actions update production words only after approval."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
