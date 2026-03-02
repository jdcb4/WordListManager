import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageJobsPanel } from "../components/common/page-jobs-panel";
import { PageHeader } from "../components/common/page-header";
import { BulkActionBar } from "../components/ui/bulk-action-bar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageFeedbackPage() {
  const { runJob } = useJobTracker();
  const [pending, setPending] = useState([]);
  const [counts, setCounts] = useState({ pending_good_count: 0, pending_bad_count: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [resolution, setResolution] = useState("keep");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

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

  const filteredRows = useMemo(
    () =>
      pending.filter((item) =>
        [item.word, item.comment, item.verdict].join(" ").toLowerCase().includes(search.toLowerCase())
      ),
    [pending, search]
  );

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAllInView() {
    setSelectedIds(filteredRows.map((item) => item.id));
  }

  async function applyResolution() {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await runJob({
        title: "Feedback: Apply resolution",
        description: `${selectedIds.length} selected row(s)`,
        source: "/manage/feedback",
        task: ({ signal }) =>
          apiPost(
            "/api/v1/manage/feedback/resolve",
            {
              feedback_ids: selectedIds,
              resolution,
              note,
            },
            { signal }
          ),
      });
      setMessage(`Processed ${data.processed} item(s). Deactivated words: ${data.deactivated_words}.`);
      setNote("");
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
        <input
          type="checkbox"
          checked={selectedIds.includes(ctx.row.original.id)}
          onChange={(event) => {
            event.stopPropagation();
            toggleSelected(ctx.row.original.id);
          }}
        />
      ),
    }),
    columnHelper.accessor("word", { header: "Word", meta: { filterVariant: "text" } }),
    columnHelper.accessor("verdict", {
      header: "Verdict",
      meta: { filterVariant: "select", filterOptions: ["good", "bad"] },
      cell: (ctx) => (
        <span className={ctx.getValue() === "bad" ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
          {ctx.getValue()}
        </span>
      ),
    }),
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
      <PageHeader
        title="Feedback Moderation"
        description="Process playtest feedback and deactivate low-quality words when needed."
        primaryAction={
          <Button onClick={applyResolution} disabled={loading || selectedIds.length === 0}>
            Apply Resolution
          </Button>
        }
        secondaryActions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
          </>
        }
      />

      <ManageTabs active="feedback" />
      <PageJobsPanel source="/manage/feedback" />

      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardContent className="pt-4 text-sm">Pending good: <strong>{counts.pending_good_count}</strong></CardContent></Card>
        <Card><CardContent className="pt-4 text-sm">Pending bad: <strong>{counts.pending_bad_count}</strong></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by word/comment/verdict" />
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
          </div>

          {!filteredRows.length ? (
            <EmptyState title="No pending feedback items" description="Feedback queue is clear for current filters." />
          ) : (
            <DataTable
              columns={columns}
              data={filteredRows}
              density="compact"
              enableColumnFilters
              emptyText="No pending feedback items."
            />
          )}

          <div className="rounded border border-border bg-muted p-3 text-xs">
            {message || "Select feedback rows and apply moderation actions in bulk."}
          </div>
        </CardContent>
      </Card>

      <BulkActionBar selectedCount={selectedIds.length}>
        <Button size="sm" variant="outline" onClick={selectAllInView}>Select all in view</Button>
        <Button size="sm" onClick={applyResolution} disabled={loading}>Apply resolution</Button>
      </BulkActionBar>
    </div>
  );
}
