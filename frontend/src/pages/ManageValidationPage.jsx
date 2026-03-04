import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { BulkActionBar } from "../components/ui/bulk-action-bar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { SideDrawer } from "../components/ui/side-drawer";
import { StatusChip } from "../components/ui/status-chip";
import { TableToolbar } from "../components/ui/table-toolbar";
import { apiGet, apiPost } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

function formatWordTypes(word) {
  if (Array.isArray(word?.word_types) && word.word_types.length) {
    return word.word_types.join(", ");
  }
  return word?.word_type || "-";
}

export function ManageValidationPage() {
  const { runJob } = useJobTracker();
  const [validation, setValidation] = useState(null);
  const [selectedIssueKeys, setSelectedIssueKeys] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeIssue, setActiveIssue] = useState(null);

  const issues = validation?.issues || [];
  const selectedIssues = useMemo(
    () => issues.filter((issue) => selectedIssueKeys.includes(issue.issue_key)),
    [issues, selectedIssueKeys]
  );
  const selectedWordIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedIssues
            .map((issue) => issue.word_id)
            .filter((value) => Number.isInteger(value))
        )
      ),
    [selectedIssues]
  );

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/validate");
      setValidation(data);
      setSelectedIssueKeys([]);
      setActiveIssue(data.issues?.[0] || null);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSelect(issueKey) {
    setSelectedIssueKeys((prev) =>
      prev.includes(issueKey) ? prev.filter((value) => value !== issueKey) : [...prev, issueKey]
    );
  }

  function selectAllVisible() {
    setSelectedIssueKeys(issues.map((issue) => issue.issue_key));
  }

  async function runWordAction(action) {
    if (!selectedWordIds.length) {
      setMessage("Select one or more word-linked issues first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const payload = { action, word_ids: selectedWordIds };
      const data = await runJob({
        title: action === "ai_complete" ? "Validation: AI complete selected" : "Validation: Deactivate selected",
        description: `${selectedWordIds.length} selected word(s)`,
        source: "/manage/validation",
        task: ({ signal }) => apiPost("/api/v1/manage/validation/action", payload, { signal }),
      });
      if (action === "deactivate") {
        setMessage(`Deactivated ${data.updated || 0} word(s).`);
      } else {
        const report = data.report || {};
        setMessage(
          `AI completion processed ${report.processed || 0}, suggested ${report.suggested || 0}, staged ${report.staged_rows || 0}.`
        );
      }
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeWarnings() {
    const warningIssues = selectedIssues
      .filter((issue) => issue.severity === "warning" && Number.isInteger(issue.word_id))
      .map((issue) => ({ word_id: issue.word_id, code: issue.code }));
    if (!warningIssues.length) {
      setMessage("Select one or more warning rows linked to words.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await runJob({
        title: "Validation: Acknowledge warnings",
        description: `${warningIssues.length} warning row(s)`,
        source: "/manage/validation",
        task: ({ signal }) =>
          apiPost(
            "/api/v1/manage/validation/acknowledge",
            { issues: warningIssues },
            { signal }
          ),
      });
      setMessage(`Acknowledged ${data.acknowledged || 0} warning(s).`);
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
          checked={selectedIssueKeys.includes(ctx.row.original.issue_key)}
          aria-label={`Select validation issue ${ctx.row.original.issue_key}`}
          onChange={(event) => {
            event.stopPropagation();
            toggleSelect(ctx.row.original.issue_key);
          }}
        />
      ),
    }),
    columnHelper.accessor("severity", {
      header: "Severity",
      meta: { filterVariant: "select", filterOptions: ["error", "warning"] },
      cell: (ctx) => <StatusChip tone={ctx.getValue() === "error" ? "danger" : "warning"}>{ctx.getValue()}</StatusChip>,
    }),
    columnHelper.accessor("code", { header: "Code", meta: { filterVariant: "text" } }),
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
              id:{word.id} | {formatWordTypes(word)} | {word.category || "-"} | {word.collection || "-"}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("message", { header: "Message", meta: { filterVariant: "text" } }),
  ];

  const noIssues = issues.length === 0;

  return (
    <ManagementPageLayout
      title="Validation Queue"
      description="Review data quality issues, deactivate or AI-complete selected words, and acknowledge accepted warnings."
      jobsSource="/manage/validation"
      primaryAction={
        <Button onClick={() => runWordAction("ai_complete")} disabled={loading || selectedWordIds.length === 0}>
          Complete Missing (Selected)
        </Button>
      }
      secondaryActions={
        <>
          <Button variant="outline" onClick={acknowledgeWarnings} disabled={loading || !selectedIssueKeys.length}>
            Acknowledge Warnings
          </Button>
          <Button variant="destructive" onClick={() => runWordAction("deactivate")} disabled={loading || selectedWordIds.length === 0}>
            Deactivate Selected
          </Button>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </>
      }
    >
      <Card>
        <CardContent className="space-y-3 pt-4">
          <TableToolbar
            left={
              <>
                <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                  Errors: {validation?.error_count ?? 0}
                </div>
                <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                  Warnings: {validation?.warning_count ?? 0}
                </div>
              </>
            }
            right={
              <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                Selected rows: {selectedIssueKeys.length}
              </div>
            }
          />

          {noIssues ? (
            <EmptyState title="No issues found" description="Validation is clean for the current dataset." />
          ) : (
            <DataTable
              columns={columns}
              data={issues.slice(0, 1000)}
              density="compact"
              enableColumnFilters
              onRowClick={setActiveIssue}
              rowClassName={(row) => (activeIssue?.issue_key === row.issue_key ? "bg-info-soft/70" : "")}
              emptyText="No validation issues found."
            />
          )}

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Use table filters for severity/code. Acknowledged warnings will not reappear for the same word/code."}
          </div>
        </CardContent>
      </Card>

      <BulkActionBar selectedCount={selectedIssueKeys.length}>
        <Button size="sm" variant="outline" onClick={selectAllVisible}>Select all in view</Button>
        <Button size="sm" variant="outline" onClick={acknowledgeWarnings} disabled={loading}>Acknowledge</Button>
        <Button size="sm" variant="destructive" onClick={() => runWordAction("deactivate")} disabled={loading}>
          Deactivate
        </Button>
        <Button size="sm" onClick={() => runWordAction("ai_complete")} disabled={loading}>
          AI complete
        </Button>
      </BulkActionBar>

      <SideDrawer
        open={!!activeIssue}
        onClose={() => setActiveIssue(null)}
        title={activeIssue?.code || "Issue details"}
        subtitle={activeIssue?.word ? `Word: ${activeIssue.word.text}` : "Dataset-level issue"}
      >
        {activeIssue ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Severity</p>
              <p className="mt-1 font-semibold">{activeIssue.severity}</p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
              <p className="mt-1">{activeIssue.message}</p>
            </div>
            {activeIssue.word ? (
              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Word context</p>
                <div className="mt-1 space-y-1">
                  <p><span className="text-muted-foreground">ID:</span> {activeIssue.word.id}</p>
                  <p><span className="text-muted-foreground">Type:</span> {formatWordTypes(activeIssue.word)}</p>
                  <p><span className="text-muted-foreground">Category:</span> {activeIssue.word.category || "-"}</p>
                  <p><span className="text-muted-foreground">Collection:</span> {activeIssue.word.collection || "-"}</p>
                  <p><span className="text-muted-foreground">Difficulty:</span> {activeIssue.word.difficulty || "-"}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SideDrawer>
    </ManagementPageLayout>
  );
}
