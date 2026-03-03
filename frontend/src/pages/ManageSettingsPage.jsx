import { useState } from "react";

import { ManagementPageLayout } from "../components/common/management-page-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { StatusChip } from "../components/ui/status-chip";
import { apiPost } from "../lib/http";
import { useAppSettings } from "../lib/app-settings";
import { useJobTracker } from "../lib/job-tracker";

export function ManageSettingsPage() {
  const { settings, setAiModel, resetSettings } = useAppSettings();
  const { runJob } = useJobTracker();
  const [draftModel, setDraftModel] = useState(settings.aiModel);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  function save() {
    setAiModel(draftModel);
    setMessage("Saved.");
    setMessageTone("success");
  }

  async function runConsolidation() {
    setMessage("");
    try {
      const result = await runJob({
        title: "Consolidate canonical words",
        description: "Merge duplicate normalized words and keep describing-preferred data.",
        source: "/manage/settings",
        task: ({ signal }) => apiPost("/api/v1/manage/consolidate", {}, { signal }),
      });
      setMessage(result.detail || "Consolidation completed.");
      setMessageTone("success");
    } catch (err) {
      setMessage(String(err));
      setMessageTone("danger");
    }
  }

  return (
    <ManagementPageLayout
      title="Settings"
      description="Global management settings used by AI tools."
      jobsSource="/manage/settings"
      primaryAction={<Button onClick={save}>Save settings</Button>}
      secondaryActions={
        <Button
          variant="outline"
          onClick={() => {
            resetSettings();
            setDraftModel("google/gemini-2.5-flash-lite");
            setMessage("Reset to defaults.");
          }}
        >
          Reset defaults
        </Button>
      }
    >
      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">AI Model</h2>
          <Input value={draftModel} onChange={(event) => setDraftModel(event.target.value)} />
          <p className="text-xs text-muted-foreground">
            Used by QA complete-missing and ingestion generation.
          </p>
          {message ? (
            <StatusChip tone={messageTone} className="w-fit text-xs font-medium">
              {message}
            </StatusChip>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">Data Maintenance</h2>
          <p className="text-xs text-muted-foreground">
            Consolidates duplicate normalized words into a single canonical row while preserving multi-type suitability.
          </p>
          <Button variant="outline" onClick={runConsolidation}>
            Run Consolidation
          </Button>
        </CardContent>
      </Card>
    </ManagementPageLayout>
  );
}
