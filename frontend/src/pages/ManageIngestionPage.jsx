import { useEffect, useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { DataTable } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { apiGet, apiPost, apiPostForm } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

const columnHelper = createColumnHelper();

export function ManageIngestionPage() {
  const { runJob } = useJobTracker();
  const [stats, setStats] = useState(null);
  const [stagingSnapshot, setStagingSnapshot] = useState({ batches: [] });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      const [statsData, stagingData] = await Promise.all([
        apiGet("/api/v1/stats"),
        apiGet("/api/v1/manage/staging?status=pending&limit=50"),
      ]);
      setStats(statsData);
      setStagingSnapshot(stagingData);
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

  async function uploadToStaging(event) {
    event.preventDefault();
    if (!uploadFile) {
      setMessage("Choose a CSV or JSON file to upload.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("note", uploadNote);
      const result = await runJob({
        title: "Ingestion: Upload file",
        description: uploadFile.name,
        source: "/manage/ingestion",
        task: () => apiPostForm("/api/v1/manage/staging/upload", formData),
      });
      setMessage(`Uploaded batch #${result.batch_id} with ${result.total_rows} rows.`);
      setUploadFile(null);
      setUploadNote("");
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function runGeneration() {
    setLoading(true);
    setMessage("");
    try {
      const data = await runJob({
        title: "Ingestion: Generate words",
        description: `${generateForm.count} ${generateForm.word_type} words`,
        source: "/manage/ingestion",
        task: () => apiPost("/api/v1/manage/ai/generate", { ...generateForm, model }),
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

  const batchColumns = [
    columnHelper.accessor("id", { header: "Batch #" }),
    columnHelper.accessor("source_filename", { header: "Source", meta: { filterVariant: "text" } }),
    columnHelper.accessor("status", {
      header: "Status",
      meta: { filterVariant: "select", filterOptions: ["pending", "in_review", "completed"] },
    }),
    columnHelper.accessor("total_rows", { header: "Rows" }),
    columnHelper.accessor("pending_count", { header: "Pending" }),
    columnHelper.accessor("approved_count", { header: "Approved" }),
    columnHelper.accessor("rejected_count", { header: "Rejected" }),
    columnHelper.accessor("created_at", {
      header: "Created",
      cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
    }),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Word Ingestion"
        description="Ingest words via file upload or AI generation. All ingested rows land in staging for review."
        primaryAction={
          <Button onClick={() => setConfirmOpen(true)} disabled={loading}>
            Generate to Staging
          </Button>
        }
        secondaryActions={
          <>
            <Button variant="outline" onClick={refresh} disabled={loading || uploading}>
              Refresh
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

      <ManageTabs active="ingestion" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <h2 className="text-base font-semibold">Upload CSV/JSON</h2>
            <form className="grid gap-2" onSubmit={uploadToStaging}>
              <input
                type="file"
                accept=".csv,.json"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                className="h-9 rounded border border-input bg-white px-2 text-sm"
              />
              <Input
                value={uploadNote}
                onChange={(event) => setUploadNote(event.target.value)}
                placeholder="Upload note"
              />
              <Button type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload to Staging"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h2 className="text-base font-semibold">AI Generate Words</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model" />
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.word_type}
                onChange={(event) =>
                  setGenerateForm((prev) => ({ ...prev, word_type: event.target.value }))
                }
              >
                <option value="guessing">guessing</option>
                <option value="describing">describing</option>
              </select>
              <Input
                type="number"
                min="1"
                max="50"
                value={generateForm.count}
                onChange={(event) =>
                  setGenerateForm((prev) => ({ ...prev, count: Number(event.target.value || 20) }))
                }
              />
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.category}
                onChange={(event) =>
                  setGenerateForm((prev) => ({ ...prev, category: event.target.value }))
                }
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
                onChange={(event) =>
                  setGenerateForm((prev) => ({ ...prev, subcategory: event.target.value }))
                }
                placeholder="Subcategory"
              />
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.difficulty}
                onChange={(event) =>
                  setGenerateForm((prev) => ({ ...prev, difficulty: event.target.value }))
                }
              >
                <option value="">(any difficulty)</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm sm:col-span-2"
                value={generateForm.collection}
                onChange={(event) =>
                  setGenerateForm((prev) => ({ ...prev, collection: event.target.value }))
                }
              >
                {["Base", ...collections.filter((item) => item !== "Base")].map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground">
              Generation is schema-constrained and writes to staging only.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">Recent Batches</h2>
          {!stagingSnapshot?.batches?.length ? (
            <EmptyState
              title="No ingestion batches yet"
              description="Upload a file or generate words with AI to create your first batch."
            />
          ) : (
            <DataTable
              columns={batchColumns}
              data={stagingSnapshot.batches}
              density="compact"
              enableColumnFilters
              emptyText="No batches found."
            />
          )}
          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Ingestion feeds staging. Review and approve in the staging queue before publish."}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Generate words into staging?"
        description={`Generate up to ${generateForm.count} ${generateForm.word_type} rows. Review in staging before publish.`}
        confirmLabel={loading ? "Generating..." : "Generate"}
        onConfirm={runGeneration}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
