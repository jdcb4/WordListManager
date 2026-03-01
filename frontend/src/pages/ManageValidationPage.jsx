import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { BulkActionBar } from "../components/ui/bulk-action-bar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { SideDrawer } from "../components/ui/side-drawer";
import { apiGet, apiPost } from "../lib/http";

const columnHelper = createColumnHelper();

export function ManageValidationPage() {
  const [validation, setValidation] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [activeIssue, setActiveIssue] = useState(null);

  const issues = validation?.issues || [];
  const filteredIssues = useMemo(
    () => (severityFilter === "all" ? issues : issues.filter((issue) => issue.severity === severityFilter)),
    [issues, severityFilter]
  );

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/validate");
      setValidation(data);
      setSelectedIds([]);
      setActiveIssue(data.issues?.[0] || null);
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

  function selectAllFiltered() {
    const ids = filteredIssues.map((row) => row.word_id).filter((value) => Number.isInteger(value));
    setSelectedIds(Array.from(new Set(ids)));
  }

  async function runAction(action, payload = {}) {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost(action, payload);
      if (action.includes("validation/action")) {
        setMessage(`Processed ${data.processed || 0} word(s).`);
      } else {
        setMessage(JSON.stringify(data));
      }
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
      cell: (ctx) =>
        ctx.row.original.word_id ? (
          <input
            type="checkbox"
            checked={selectedIds.includes(ctx.row.original.word_id)}
            onChange={(event) => {
              event.stopPropagation();
              toggleSelect(ctx.row.original.word_id);
            }}
          />
        ) : null,
    }),
    columnHelper.accessor("severity", {
      header: "Severity",
      meta: { filterVariant: "select", filterOptions: ["error", "warning"] },
      cell: (ctx) => (
        <span className={ctx.getValue() === "error" ? "text-red-700 font-semibold" : "text-amber-700 font-semibold"}>
          {ctx.getValue()}
        </span>
      ),
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
              id:{word.id} | {word.word_type} | {word.category || "-"} | {word.collection || "-"}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("message", { header: "Message" }),
  ];

  const noIssues = issues.length === 0;
  const noFilteredIssues = !noIssues && filteredIssues.length === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Validation Queue"
        description="Review data quality issues, then resolve with deactivation or AI completion into staging."
        primaryAction={
          <Button
            onClick={() => runAction("/api/v1/manage/validation/action", { action: "ai_complete", model, word_ids: selectedIds })}
            disabled={loading || selectedIds.length === 0}
          >
            Complete Missing (Selected)
          </Button>
        }
        secondaryActions={
          <>
            <Button
              variant="destructive"
              onClick={() => runAction("/api/v1/manage/validation/action", { action: "deactivate", word_ids: selectedIds })}
              disabled={loading || selectedIds.length === 0}
            >
              Deactivate Selected
            </Button>
            <Button variant="outline" onClick={refresh}>Refresh</Button>
          </>
        }
      />

      <ManageTabs active="validation" />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 md:grid-cols-[auto_auto_auto_1fr]">
            <Button variant={severityFilter === "all" ? "default" : "outline"} onClick={() => setSeverityFilter("all")}>All ({issues.length})</Button>
            <Button variant={severityFilter === "error" ? "default" : "outline"} onClick={() => setSeverityFilter("error")}>Errors ({validation?.error_count ?? 0})</Button>
            <Button variant={severityFilter === "warning" ? "default" : "outline"} onClick={() => setSeverityFilter("warning")}>Warnings ({validation?.warning_count ?? 0})</Button>
            <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="AI model" />
          </div>

          {noIssues ? (
            <EmptyState title="No issues found" description="Validation is clean for the current dataset." />
          ) : noFilteredIssues ? (
            <EmptyState title="No issues match this filter" description="Switch severity tabs to see other issue types." />
          ) : (
            <DataTable
              columns={columns}
              data={filteredIssues.slice(0, 1000)}
              density="compact"
              enableColumnFilters
              onRowClick={setActiveIssue}
              rowClassName={(row) => (activeIssue?.code === row.code && activeIssue?.word_id === row.word_id ? "bg-sky-50" : "")}
              emptyText="No validation issues found."
            />
          )}

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Select rows and run an action. AI completion writes updates to staging for review."}
          </div>
        </CardContent>
      </Card>

      <BulkActionBar selectedCount={selectedIds.length}>
        <Button size="sm" variant="outline" onClick={selectAllFiltered}>Select all in view</Button>
        <Button size="sm" variant="destructive" onClick={() => runAction("/api/v1/manage/validation/action", { action: "deactivate", word_ids: selectedIds })} disabled={loading}>
          Deactivate
        </Button>
        <Button size="sm" onClick={() => runAction("/api/v1/manage/validation/action", { action: "ai_complete", model, word_ids: selectedIds })} disabled={loading}>
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
                  <p><span className="text-muted-foreground">Type:</span> {activeIssue.word.word_type}</p>
                  <p><span className="text-muted-foreground">Category:</span> {activeIssue.word.category || "-"}</p>
                  <p><span className="text-muted-foreground">Collection:</span> {activeIssue.word.collection || "-"}</p>
                  <p><span className="text-muted-foreground">Difficulty:</span> {activeIssue.word.difficulty || "-"}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SideDrawer>
    </div>
  );
}
