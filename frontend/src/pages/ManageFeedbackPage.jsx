import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";

const columnHelper = createColumnHelper();

export function ManageFeedbackPage() {
  const [pending, setPending] = useState([]);
  const [counts, setCounts] = useState({ pending_good_count: 0, pending_bad_count: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [resolution, setResolution] = useState("keep");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [commentFilter, setCommentFilter] = useState("");

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/feedback/pending");
      setPending(data.results || []);
      setCounts({
        pending_good_count: data.pending_good_count || 0,
        pending_bad_count: data.pending_bad_count || 0,
      });
      setSelectedIds([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAll() {
    setSelectedIds(filteredRows.map((item) => item.id));
  }

  async function applyResolution() {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost("/api/v1/manage/feedback/resolve", {
        feedback_ids: selectedIds,
        resolution,
        note,
      });
      setMessage(
        `Processed ${data.processed} item(s). Deactivated words: ${data.deactivated_words}.`
      );
      setNote("");
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = pending.filter((item) =>
    [item.word, item.comment, item.verdict].join(" ").toLowerCase().includes(commentFilter.toLowerCase())
  );

  const columns = [
    columnHelper.display({
      id: "select",
      header: "Select",
      cell: (ctx) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(ctx.row.original.id)}
          onChange={() => toggleSelected(ctx.row.original.id)}
        />
      ),
    }),
    columnHelper.accessor("word", { header: "Word" }),
    columnHelper.accessor("verdict", { header: "Verdict" }),
    columnHelper.accessor("comment", {
      header: "Comment",
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("created_at", {
      header: "Created",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
  ];

  return (
    <div className="space-y-4">
      <ManageTabs active="feedback" />
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-fuchsia-100 via-rose-50 to-amber-100">
          <CardTitle>Feedback Moderation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-border bg-white p-3 text-sm">
              Pending good: <strong>{counts.pending_good_count}</strong>
            </div>
            <div className="rounded border border-border bg-white p-3 text-sm">
              Pending bad: <strong>{counts.pending_bad_count}</strong>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAll}>Select All</Button>
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
            >
              <option value="keep">keep</option>
              <option value="deactivate">deactivate</option>
              <option value="ignore">ignore</option>
            </select>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Moderator note" />
            <Input value={commentFilter} onChange={(event) => setCommentFilter(event.target.value)} placeholder="Filter comment/word" />
            <Button onClick={applyResolution} disabled={loading || selectedIds.length === 0}>Apply to Selected</Button>
            <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
          </div>
          <DataTable columns={columns} data={filteredRows} emptyText="No pending feedback items." />
          <div className="rounded border border-border bg-muted p-3 text-xs">
            {message || "Select rows and apply moderation action."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
