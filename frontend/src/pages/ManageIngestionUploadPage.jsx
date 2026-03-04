import { useEffect, useRef, useState } from "react";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiGet, apiPostForm } from "../lib/http";
import { useJobTracker } from "../lib/job-tracker";

export function ManageIngestionUploadPage() {
  const { runJob } = useJobTracker();
  const fileInputRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNote, setUploadNote] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  async function refresh() {
    try {
      const statsData = await apiGet("/api/v1/stats");
      setStats(statsData);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

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
        source: "/manage/ingestion/upload",
        task: ({ signal }) => apiPostForm("/api/v1/manage/staging/upload", formData, { signal }),
      });
      setMessage(`Uploaded batch #${result.batch_id} with ${result.total_rows} rows.`);
      setUploadFile(null);
      setUploadNote("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (!dropped) return;
    setUploadFile(dropped);
  }

  return (
    <ManagementPageLayout
      title="Ingestion: Upload Files"
      description="Upload CSV or JSON sources into staging. Review and approve in Staging Review before publish."
      jobsSource="/manage/ingestion/upload"
      primaryAction={
        <a
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          href="/manage/ingestion/generate"
        >
          Go To AI Generate
        </a>
      }
      secondaryActions={
        <>
          <Button variant="outline" onClick={refresh} disabled={uploading}>
            Refresh
          </Button>
          <a
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm"
            href="/manage/staging"
          >
            Open Staging Review
          </a>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Active words: {stats?.total_active_words ?? "..."}
        </div>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Dataset version: {stats?.dataset_version ?? "..."}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">Upload CSV/JSON</h2>
          <form className="space-y-3" onSubmit={uploadToStaging}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              aria-label="Upload CSV or JSON file"
              className="hidden"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={handleDrop}
              className={
                isDragOver
                  ? "flex h-28 w-full items-center justify-center rounded-lg border-2 border-dashed border-primary bg-info-soft text-sm"
                  : "flex h-28 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted text-sm"
              }
            >
              {uploadFile ? `Selected: ${uploadFile.name}` : "Drag and drop CSV/JSON here, or click to browse"}
            </button>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={uploadNote}
                aria-label="Upload note"
                onChange={(event) => setUploadNote(event.target.value)}
                placeholder="Upload note"
              />
              <Button type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload To Staging"}
              </Button>
            </div>
          </form>
          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Supported formats: CSV, JSON. Uploaded rows are always queued in staging."}
          </div>
        </CardContent>
      </Card>
    </ManagementPageLayout>
  );
}
