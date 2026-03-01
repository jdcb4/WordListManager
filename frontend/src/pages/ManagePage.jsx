import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiGet, apiPost, apiPostForm } from "../lib/http";

export function ManagePage({ mode = "all" }) {
  const showDashboard = mode === "all" || mode === "dashboard";
  const showStaging = mode === "all" || mode === "staging";
  const showValidation = mode === "all" || mode === "validation";
  const showAi = mode === "all" || mode === "dashboard";

  const [dashboard, setDashboard] = useState(null);
  const [validation, setValidation] = useState(null);
  const [staging, setStaging] = useState({ total: 0, results: [], batches: [] });
  const [stagingFilters, setStagingFilters] = useState({ status: "pending", batch_id: "", limit: 200 });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedStagedIds, setSelectedStagedIds] = useState([]);
  const [expandedStagedRows, setExpandedStagedRows] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [generateForm, setGenerateForm] = useState({
    word_type: "guessing",
    count: 20,
    category: "",
    subcategory: "",
    difficulty: "",
    collection: "Base",
  });

  async function refresh() {
    try {
      const tasks = [];
      if (showDashboard) {
        tasks.push(
          apiGet("/api/v1/manage/dashboard").then((data) => {
            setDashboard(data);
          })
        );
      }
      if (showValidation) {
        tasks.push(
          apiGet("/api/v1/manage/validate").then((data) => {
            setValidation(data);
          })
        );
      }
      if (showStaging) {
        const params = new URLSearchParams();
        if (stagingFilters.status) params.set("status", stagingFilters.status);
        if (stagingFilters.batch_id) params.set("batch_id", stagingFilters.batch_id);
        params.set("limit", String(stagingFilters.limit || 200));
        tasks.push(
          apiGet(`/api/v1/manage/staging?${params.toString()}`).then((data) => {
            setStaging(data);
          })
        );
      }
      await Promise.all(tasks);
      setSelectedIds([]);
      setSelectedStagedIds([]);
      setExpandedStagedRows([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, [mode, stagingFilters.status, stagingFilters.batch_id, stagingFilters.limit]);

  async function runAction(action, payload = {}) {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost(action, payload);
      setMessage(JSON.stringify(data));
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function toggleStagedSelect(id) {
    setSelectedStagedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function toggleStagedDiff(id) {
    setExpandedStagedRows((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAll() {
    const ids = (validation?.issues || [])
      .map((row) => row.word_id)
      .filter((value) => Number.isInteger(value));
    setSelectedIds(Array.from(new Set(ids)));
  }

  function selectAllStaged() {
    const ids = (staging?.results || []).map((row) => row.id).filter((value) => Number.isInteger(value));
    setSelectedStagedIds(Array.from(new Set(ids)));
  }

  async function runStagingReview(action) {
    if (selectedStagedIds.length === 0) return;
    await runAction("/api/v1/manage/staging/review", {
      action,
      staged_word_ids: selectedStagedIds,
      note: "",
    });
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
      setMessage(
        `Uploaded staging batch ${result.batch_id} with ${result.total_rows} row(s).`
      );
      setUploadFile(null);
      setUploadNote("");
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-4">
          <a className="rounded-full border border-border bg-white px-3 py-1 text-sm" href="/manage/">Overview</a>
          <a className="rounded-full border border-border bg-white px-3 py-1 text-sm" href="/manage/staging/">Staging</a>
          <a className="rounded-full border border-border bg-white px-3 py-1 text-sm" href="/manage/validation/">Validation</a>
          <a className="rounded-full border border-border bg-white px-3 py-1 text-sm" href="/manage/feedback/">Feedback</a>
        </CardContent>
      </Card>
      {showDashboard ? (
      <Card>
        <CardHeader>
          <CardTitle>Management (React Transition)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-muted-foreground">
            This page uses new management API endpoints. Keep Django admin unchanged.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runAction("/api/v1/manage/publish", {})} disabled={loading}>One-Click Publish</Button>
            <Button variant="outline" onClick={() => runAction("/api/v1/manage/dedupe", {})} disabled={loading}>Dedupe</Button>
            <Button variant="outline" onClick={() => refresh()} disabled={loading}>Refresh</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-border bg-white p-3 text-sm">
              Active words: <strong>{dashboard?.total_active_words ?? "..."}</strong>
            </div>
            <div className="rounded border border-border bg-white p-3 text-sm">
              Version: <strong>{dashboard?.dataset_version ?? "..."}</strong>
            </div>
          </div>
          <div className="rounded border border-border bg-muted p-3 text-xs">{message || "No recent action output."}</div>
        </CardContent>
      </Card>
      ) : (
        <div className="rounded border border-border bg-muted p-3 text-xs">{message || "No recent action output."}</div>
      )}

      {showStaging ? (
      <Card>
        <CardHeader>
          <CardTitle>Staging Review (React Migration)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" onSubmit={uploadStagingFile}>
            <input
              type="file"
              accept=".csv,.json"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              className="h-9 rounded border border-input bg-white px-2 text-sm"
            />
            <Input value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} placeholder="Upload note" />
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload to Staging"}
            </Button>
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
                <option key={batch.id} value={batch.id}>
                  #{batch.id} {batch.source_filename}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="1"
              max="500"
              value={stagingFilters.limit}
              onChange={(event) => setStagingFilters((prev) => ({ ...prev, limit: Number(event.target.value || 200) }))}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {(staging?.results || []).length} of {staging?.total || 0} staged row(s).
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAllStaged}>Select All</Button>
            <Button onClick={() => runStagingReview("approve")} disabled={loading || selectedStagedIds.length === 0}>
              Approve Selected
            </Button>
            <Button variant="destructive" onClick={() => runStagingReview("reject")} disabled={loading || selectedStagedIds.length === 0}>
              Reject Selected
            </Button>
          </div>

          <div className="max-h-[500px] overflow-auto rounded border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Select</th>
                  <th className="px-2 py-1 text-left">Word</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Batch</th>
                  <th className="px-2 py-1 text-left">Preview</th>
                  <th className="px-2 py-1 text-left">Changed Components</th>
                  <th className="px-2 py-1 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                {(staging?.results || []).map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedStagedIds.includes(row.id)}
                        onChange={() => toggleStagedSelect(row.id)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <div className="font-semibold">{row.word}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.category || "-"} | {row.collection || "-"} | {row.difficulty || "-"}
                      </div>
                    </td>
                    <td className="px-2 py-1">{row.word_type}</td>
                    <td className="px-2 py-1">#{row.batch.id}</td>
                    <td className="px-2 py-1">
                      <span className={`rounded px-2 py-1 text-xs ${row.preview.is_new ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {row.preview.is_new ? "Create New" : "Update Existing"}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap gap-1">
                        {row.preview.changed_fields.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No changes</span>
                        ) : (
                          row.preview.changed_fields.map((field) => (
                            <span key={`${row.id}-${field}`} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
                              {field}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <Button variant="outline" onClick={() => toggleStagedDiff(row.id)}>
                        {expandedStagedRows.includes(row.id) ? "Hide" : "View"}
                      </Button>
                      {expandedStagedRows.includes(row.id) ? (
                        <div className="mt-2 overflow-auto rounded border border-border bg-white">
                          <table className="min-w-[480px] text-xs">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-2 py-1 text-left">Field</th>
                                <th className="px-2 py-1 text-left">Current</th>
                                <th className="px-2 py-1 text-left">Staged</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.preview.fields.map((fieldDiff) => (
                                <tr key={`${row.id}-${fieldDiff.field}`} className={`border-t border-border ${fieldDiff.changed ? "bg-amber-50" : ""}`}>
                                  <td className="px-2 py-1 font-medium">{fieldDiff.field}</td>
                                  <td className="px-2 py-1">{fieldDiff.from || "-"}</td>
                                  <td className="px-2 py-1">{fieldDiff.to || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showAi ? (
      <Card>
        <CardHeader>
          <CardTitle>AI Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-sm" value={model} onChange={(e) => setModel(e.target.value)} placeholder="model" />
            <Button
              onClick={() => runAction("/api/v1/manage/ai/complete", { model, limit: 200 })}
              disabled={loading}
            >
              AI Complete Missing (Staged)
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select className="h-9 rounded border border-input bg-white px-3 text-sm" value={generateForm.word_type} onChange={(e) => setGenerateForm((prev) => ({ ...prev, word_type: e.target.value }))}>
              <option value="guessing">guessing</option>
              <option value="describing">describing</option>
            </select>
            <Input type="number" min="1" max="50" value={generateForm.count} onChange={(e) => setGenerateForm((prev) => ({ ...prev, count: Number(e.target.value || 20) }))} />
            <Input value={generateForm.category} onChange={(e) => setGenerateForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="category" />
            <Input value={generateForm.subcategory} onChange={(e) => setGenerateForm((prev) => ({ ...prev, subcategory: e.target.value }))} placeholder="subcategory" />
            <Input value={generateForm.difficulty} onChange={(e) => setGenerateForm((prev) => ({ ...prev, difficulty: e.target.value }))} placeholder="difficulty" />
            <Input value={generateForm.collection} onChange={(e) => setGenerateForm((prev) => ({ ...prev, collection: e.target.value }))} placeholder="collection" />
          </div>
          <Button
            onClick={() => runAction("/api/v1/manage/ai/generate", { ...generateForm, model })}
            disabled={loading}
          >
            AI Generate To Staging
          </Button>
        </CardContent>
      </Card>
      ) : null}

      {showValidation ? (
      <Card>
        <CardHeader>
          <CardTitle>Validation Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            Errors: <strong>{validation?.error_count ?? "..."}</strong> | Warnings: <strong>{validation?.warning_count ?? "..."}</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAll}>Select All</Button>
            <Button variant="destructive" onClick={() => runAction("/api/v1/manage/validation/action", { action: "deactivate", word_ids: selectedIds })} disabled={loading || selectedIds.length === 0}>
              Deactivate Selected
            </Button>
            <Button onClick={() => runAction("/api/v1/manage/validation/action", { action: "ai_complete", model, word_ids: selectedIds })} disabled={loading || selectedIds.length === 0}>
              AI Complete Selected (Staged)
            </Button>
          </div>
          <div className="max-h-[420px] overflow-auto rounded border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Select</th>
                  <th className="px-2 py-1 text-left">Severity</th>
                  <th className="px-2 py-1 text-left">Code</th>
                  <th className="px-2 py-1 text-left">Word Id</th>
                  <th className="px-2 py-1 text-left">Message</th>
                </tr>
              </thead>
              <tbody>
                {(validation?.issues || []).slice(0, 300).map((issue, idx) => (
                  <tr key={`${issue.word_id}-${issue.code}-${idx}`} className="border-t border-border">
                    <td className="px-2 py-1">
                      {issue.word_id ? (
                        <input type="checkbox" checked={selectedIds.includes(issue.word_id)} onChange={() => toggleSelect(issue.word_id)} />
                      ) : null}
                    </td>
                    <td className="px-2 py-1">{issue.severity}</td>
                    <td className="px-2 py-1">{issue.code}</td>
                    <td className="px-2 py-1">{issue.word_id ?? "-"}</td>
                    <td className="px-2 py-1">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
