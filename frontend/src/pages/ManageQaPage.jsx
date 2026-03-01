import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { BulkActionBar } from "../components/ui/bulk-action-bar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageQaPage() {
  const { runJob } = useJobTracker();
  const [qaCandidates, setQaCandidates] = useState({ count: 0, results: [], generated_at_utc: null });
  const [scope, setScope] = useState("all_missing");
  const [selectedWordIds, setSelectedWordIds] = useState([]);
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [limit, setLimit] = useState(200);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/qa/candidates?limit=2000");
      setQaCandidates(data);
      setSelectedWordIds([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const candidateRows = useMemo(() => qaCandidates?.results || [], [qaCandidates]);

  function toggleSelected(id) {
    setSelectedWordIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function selectAllCandidates() {
    setSelectedWordIds(candidateRows.map((row) => row.id));
  }

  const estimatedCount =
    scope === "selected_words" ? selectedWordIds.length : qaCandidates?.count || 0;

  async function runCompleteMissing() {
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        model,
        limit,
        ...(scope === "selected_words" ? { word_ids: selectedWordIds } : {}),
      };
      const data = await runJob({
        title: "QA: Complete Missing Fields",
        description: `${scope === "selected_words" ? selectedWordIds.length : qaCandidates?.count || 0} candidate rows`,
        source: "/manage/qa",
        task: () => apiPost("/api/v1/manage/ai/complete", payload),
      });
      setMessage(
        `Processed ${data.processed}, suggested ${data.suggested}, staged ${data.staged_rows}. Batch #${data.batch_id ?? "-"}.`
      );
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  const columns = [
    columnHelper.display({
      id: "select",
      header: "Select",
      cell: (ctx) => (
        <input
          type="checkbox"
          checked={selectedWordIds.includes(ctx.row.original.id)}
          onChange={(event) => {
            event.stopPropagation();
            toggleSelected(ctx.row.original.id);
          }}
        />
      ),
    }),
    columnHelper.accessor("text", { header: "Word", meta: { filterVariant: "text" } }),
    columnHelper.accessor("word_type", {
      header: "Type",
      meta: { filterVariant: "select", filterOptions: ["guessing", "describing"] },
    }),
    columnHelper.accessor("category", { header: "Category", meta: { filterVariant: "text" } }),
    columnHelper.accessor("difficulty", {
      header: "Difficulty",
      meta: { filterVariant: "select", filterOptions: ["", "easy", "medium", "hard"] },
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("missing_summary", { header: "Missing Fields", meta: { filterVariant: "text" } }),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="QA Tools"
        description="Use AI-assisted completion to fill missing fields. Suggestions are staged for review."
        primaryAction={
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || (scope === "selected_words" && selectedWordIds.length === 0)}
          >
            Complete Missing to Staging
          </Button>
        }
        secondaryActions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Recompute Rules
            </Button>
            <a
              className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm"
              href="/manage/staging/"
            >
              Open Staging
            </a>
          </>
        }
      />

      <ManageTabs active="qa" />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="AI model" />
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="all_missing">All words with missing fields</option>
              <option value="selected_words">Only selected words in table</option>
            </select>
            <Input
              type="number"
              min="1"
              max="2000"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value || 200))}
            />
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Estimated rows: {estimatedCount}
            </div>
          </div>

          {!candidateRows.length ? (
            <EmptyState
              title="No missing-field candidates"
              description="No active words currently match missing hint/difficulty rules."
            />
          ) : (
            <DataTable
              columns={columns}
              data={candidateRows}
              density="compact"
              enableColumnFilters
              emptyText="No candidates found."
            />
          )}

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message ||
              `For selected mode, choose rows in the table then run complete missing. Last recompute: ${
                qaCandidates?.generated_at_utc ? new Date(qaCandidates.generated_at_utc).toLocaleString() : "-"
              }.`}
          </div>
        </CardContent>
      </Card>

      <BulkActionBar selectedCount={selectedWordIds.length}>
        <Button size="sm" variant="outline" onClick={selectAllCandidates}>
          Select all candidates
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={loading}>
          Run complete missing on selected
        </Button>
      </BulkActionBar>

      <ConfirmDialog
        open={confirmOpen}
        title="Run Complete Missing Fields?"
        description={`Scope: ${scope === "selected_words" ? "selected words" : "all candidates"}. Estimated rows: ${estimatedCount}.`}
        confirmLabel={loading ? "Running..." : "Run"}
        onConfirm={runCompleteMissing}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
