import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { PageJobsPanel } from "../components/common/page-jobs-panel";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { apiGet, apiPost } from "../lib/http";
import { useAppSettings } from "../lib/app-settings";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageQaPage() {
  const { settings } = useAppSettings();
  const { runJob } = useJobTracker();
  const [qaCandidates, setQaCandidates] = useState({ count: 0, results: [], generated_at_utc: null });
  const [selectedWordIds, setSelectedWordIds] = useState([]);
  const [processAll, setProcessAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startNoticeOpen, setStartNoticeOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/qa/candidates?limit=5000");
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
  const estimatedCount = processAll ? qaCandidates?.count || 0 : selectedWordIds.length;

  function toggleSelected(id) {
    setSelectedWordIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function selectAllCandidates() {
    setSelectedWordIds(candidateRows.map((row) => row.id));
  }

  function clearSelectedCandidates() {
    setSelectedWordIds([]);
  }

  async function runCompleteMissing() {
    setLoading(true);
    setMessage("");
    try {
      const payload = processAll
        ? {
            model: settings.aiModel,
            limit: Math.max(qaCandidates?.count || 0, 1),
          }
        : {
            model: settings.aiModel,
            word_ids: selectedWordIds,
          };
      const data = await runJob({
        title: "QA: Complete Missing Fields",
        description: processAll ? "All candidates" : `${selectedWordIds.length} selected candidates`,
        source: "/manage/qa",
        task: ({ signal }) => apiPost("/api/v1/manage/ai/complete", payload, { signal }),
      });
      setMessage(
        `Processed ${data.processed}, suggested ${data.suggested}, staged ${data.staged_rows}. Batch #${data.batch_id ?? "-"}.`
      );
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  function launchRun() {
    setConfirmOpen(false);
    setStartNoticeOpen(true);
    void runCompleteMissing();
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
        description="Selection-first workflow: choose candidate rows, then run AI completion into staging."
        primaryAction={
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || (!processAll && selectedWordIds.length === 0)}
          >
            {processAll ? "Run Complete Missing on All" : "Run Complete Missing on Selected"}
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
      <PageJobsPanel source="/manage/qa" />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Model: {settings.aiModel}
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={processAll}
                onChange={(event) => setProcessAll(event.target.checked)}
              />
              Process all candidates ({qaCandidates?.count || 0})
            </label>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Selected: {selectedWordIds.length}
            </div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Estimated rows: {estimatedCount}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={selectAllCandidates} disabled={!candidateRows.length}>
              Select all candidates
            </Button>
            <Button size="sm" variant="outline" onClick={clearSelectedCandidates} disabled={!selectedWordIds.length}>
              Clear selection
            </Button>
            <span className="text-xs text-muted-foreground">
              {processAll
                ? "Process-all mode enabled. Selection is ignored."
                : "Selection mode enabled."}
            </span>
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
              `Last recompute: ${
                qaCandidates?.generated_at_utc ? new Date(qaCandidates.generated_at_utc).toLocaleString() : "-"
              }.`}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Run Complete Missing Fields?"
        description={`Mode: ${processAll ? "all candidates" : "selected words only"}. Estimated rows: ${estimatedCount}.`}
        confirmLabel="Run"
        onConfirm={launchRun}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={startNoticeOpen}
        title="QA job started"
        description="This job is running in the background. Use Page Jobs or the Jobs tab to track/cancel it."
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setStartNoticeOpen(false)}
        onCancel={() => setStartNoticeOpen(false)}
      />
    </div>
  );
}

