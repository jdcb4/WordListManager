import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";

const columnHelper = createColumnHelper();

export function ManageValidationPage() {
  const [validation, setValidation] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const issues = validation?.issues || [];

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/validate");
      setValidation(data);
      setSelectedIds([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAll() {
    const ids = issues.map((row) => row.word_id).filter((value) => Number.isInteger(value));
    setSelectedIds(Array.from(new Set(ids)));
  }

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

  const columns = [
    columnHelper.display({
      id: "select",
      header: "Select",
      cell: (ctx) => (
        ctx.row.original.word_id ? (
          <input
            type="checkbox"
            checked={selectedIds.includes(ctx.row.original.word_id)}
            onChange={() => toggleSelect(ctx.row.original.word_id)}
          />
        ) : null
      ),
    }),
    columnHelper.accessor("severity", { header: "Severity" }),
    columnHelper.accessor("code", { header: "Code" }),
    columnHelper.display({
      id: "word",
      header: "Word",
      cell: (ctx) => {
        const word = ctx.row.original.word;
        if (!word) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div>
            <div className="font-semibold">{word.text}</div>
            <div className="text-xs text-muted-foreground">
              id:{word.id} | {word.word_type} | {word.category || "-"} | {word.collection || "-"}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("message", { header: "Message" }),
  ];

  return (
    <div className="space-y-4">
      <ManageTabs active="validation" />
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-rose-100 via-amber-50 to-orange-100">
          <CardTitle>Validation Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="text-sm">
            Errors: <strong>{validation?.error_count ?? "..."}</strong> | Warnings: <strong>{validation?.warning_count ?? "..."}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={selectAll}>Select All</Button>
            <Button variant="destructive" onClick={() => runAction("/api/v1/manage/validation/action", { action: "deactivate", word_ids: selectedIds })} disabled={loading || selectedIds.length === 0}>
              Deactivate Selected
            </Button>
            <Input className="max-w-xs" value={model} onChange={(event) => setModel(event.target.value)} placeholder="AI model" />
            <Button onClick={() => runAction("/api/v1/manage/validation/action", { action: "ai_complete", model, word_ids: selectedIds })} disabled={loading || selectedIds.length === 0}>
              AI Complete Selected
            </Button>
            <Button variant="outline" onClick={refresh}>Refresh</Button>
          </div>

          <DataTable columns={columns} data={issues.slice(0, 500)} emptyText="No validation issues found." />

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Validation actions target specific affected words shown in this table."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
