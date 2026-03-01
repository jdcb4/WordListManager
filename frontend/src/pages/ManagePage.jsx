import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";

export function ManagePage() {
  const [dashboard, setDashboard] = useState(null);
  const [validation, setValidation] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
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
      const [dashData, validationData] = await Promise.all([
        apiGet("/api/v1/manage/dashboard"),
        apiGet("/api/v1/manage/validate"),
      ]);
      setDashboard(dashData);
      setValidation(validationData);
      setSelectedIds([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

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

  function selectAll() {
    const ids = (validation?.issues || [])
      .map((row) => row.word_id)
      .filter((value) => Number.isInteger(value));
    setSelectedIds(Array.from(new Set(ids)));
  }

  return (
    <div className="space-y-4">
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
    </div>
  );
}
