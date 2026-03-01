import { useEffect, useMemo, useState } from "react";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { StatCard } from "../components/common/stat-card";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { apiGet, apiPost } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

function stringifyReport(report) {
  if (!report || typeof report !== "object") return String(report || "");
  const status = report.published ? "Published" : report.blocked_by_validation ? "Publish blocked" : "No publish changes";
  const version = report.dataset_version ?? "-";
  const count = report.active_word_count ?? "-";
  return `${status}. Version: ${version}. Active words: ${count}.`;
}

export function ManagePage() {
  const { runJob } = useJobTracker();
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/dashboard");
      setDashboard(data);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function runAction(action) {
    setLoading(true);
    setMessage("");
    try {
      const data = await runJob({
        title: action.includes("/publish") ? "Publish dataset" : "Run maintenance action",
        description: action,
        source: "/manage",
        task: () => apiPost(action, {}),
      });
      setMessage(stringifyReport(data));
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
      setPublishOpen(false);
    }
  }

  const collectionsCount = useMemo(() => (dashboard?.collections || []).length, [dashboard]);
  const typeSummary = useMemo(
    () =>
      (dashboard?.types || [])
        .map((entry) => `${entry.word_type}: ${entry.total}`)
        .join(" | ") || "No type data",
    [dashboard]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Management Overview"
        description="Run publish and maintenance operations. Core workflow: ingest to staging, validate quality, then publish."
        primaryAction={
          <Button onClick={() => setPublishOpen(true)} disabled={loading}>
            Publish Dataset
          </Button>
        }
        secondaryActions={
          <>
            <Button variant="outline" onClick={() => runAction("/api/v1/manage/dedupe")} disabled={loading}>
              Dedupe
            </Button>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </>
        }
      />

      <ManageTabs active="overview" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active words" value={dashboard?.total_active_words ?? "..."} />
        <StatCard label="Dataset version" value={dashboard?.dataset_version ?? "..."} hint="Increments when publish creates a new export." />
        <StatCard label="Collections" value={collectionsCount || "..."} hint={(dashboard?.collections || []).slice(0, 3).map((item) => `${item.collection__name || "Unassigned"} (${item.total})`).join(", ") || "No collection data"} />
        <StatCard label="Word types" value={(dashboard?.types || []).length || "..."} hint={typeSummary} />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workflow</h2>
          <div className="grid gap-2 text-sm md:grid-cols-5">
            <div className="rounded-lg border border-border bg-muted px-3 py-2">Import</div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2">Review</div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2">Validate</div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2">Publish</div>
            <div className="rounded-lg border border-border bg-muted px-3 py-2">Playtest</div>
          </div>
          <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
            {message || "Use tabs for ingestion, staging review, QA completion, validation queues, and feedback moderation."}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={publishOpen}
        title="Publish current dataset?"
        description={`Current version: ${dashboard?.dataset_version ?? "unknown"}. This runs dedupe + validation and creates a new export if changes exist.`}
        confirmLabel={loading ? "Publishing..." : "Run Publish"}
        onConfirm={() => runAction("/api/v1/manage/publish")}
        onCancel={() => setPublishOpen(false)}
      />
    </div>
  );
}
