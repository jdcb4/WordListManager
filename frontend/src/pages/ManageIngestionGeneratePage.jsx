import { useEffect, useMemo, useState } from "react";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";
import { useAppSettings } from "../lib/app-settings";
import { useJobTracker } from "../lib/job-tracker";

export function ManageIngestionGeneratePage() {
  const { settings } = useAppSettings();
  const { runJob } = useJobTracker();
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      const data = await apiGet("/api/v1/stats");
      setStats(data);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const categories = useMemo(
    () => (stats?.categories || []).map((item) => item.category__name).filter(Boolean),
    [stats]
  );
  const collections = useMemo(
    () => (stats?.collections || []).map((item) => item.collection__name).filter(Boolean),
    [stats]
  );

  async function runGeneration() {
    setLoading(true);
    setMessage("");
    try {
      const data = await runJob({
        title: "Ingestion: Generate words",
        description: `${generateForm.count} ${generateForm.word_type} words`,
        source: "/manage/ingestion/generate",
        task: ({ signal }) =>
          apiPost("/api/v1/manage/ai/generate", { ...generateForm, model: settings.aiModel }, { signal }),
      });
      setMessage(
        `Generated ${data.generated}/${data.requested} rows to staging. Batch #${data.batch_id ?? "-"}.`
      );
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  return (
    <ManagementPageLayout
      title="Ingestion: AI Generate"
      description="Generate candidate words into staging using the configured model and metadata constraints."
      jobsSource="/manage/ingestion/generate"
      primaryAction={
        <Button onClick={() => setConfirmOpen(true)} disabled={loading}>
          Generate To Staging
        </Button>
      }
      secondaryActions={
        <>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <a
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm"
            href="/manage/ingestion/batches"
          >
            View Batches
          </a>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Model: {settings.aiModel}
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Active words: {stats?.total_active_words ?? "..."}
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Dataset version: {stats?.dataset_version ?? "..."}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">Generation Settings</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              aria-label="Word type"
              value={generateForm.word_type}
              onChange={(event) => setGenerateForm((prev) => ({ ...prev, word_type: event.target.value }))}
            >
              <option value="guessing">guessing</option>
              <option value="describing">describing</option>
            </select>
            <Input
              type="number"
              min="1"
              max="50"
              aria-label="Generate count"
              value={generateForm.count}
              onChange={(event) =>
                setGenerateForm((prev) => ({ ...prev, count: Number(event.target.value || 20) }))
              }
            />
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              aria-label="Category"
              value={generateForm.category}
              onChange={(event) => setGenerateForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="">(no category)</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <Input
              value={generateForm.subcategory}
              aria-label="Subcategory"
              onChange={(event) => setGenerateForm((prev) => ({ ...prev, subcategory: event.target.value }))}
              placeholder="Subcategory"
            />
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              aria-label="Difficulty"
              value={generateForm.difficulty}
              onChange={(event) => setGenerateForm((prev) => ({ ...prev, difficulty: event.target.value }))}
            >
              <option value="">(any difficulty)</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              aria-label="Collection"
              value={generateForm.collection}
              onChange={(event) => setGenerateForm((prev) => ({ ...prev, collection: event.target.value }))}
            >
              {["Base", ...collections.filter((item) => item !== "Base")].map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Generated rows are staged only. Review in Staging Review before publishing."}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Generate words into staging?"
        description={`Generate up to ${generateForm.count} ${generateForm.word_type} rows using ${settings.aiModel}.`}
        confirmLabel={loading ? "Generating..." : "Generate"}
        onConfirm={runGeneration}
        onCancel={() => setConfirmOpen(false)}
      />
    </ManagementPageLayout>
  );
}
