import { useState } from "react";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useAppSettings } from "../lib/app-settings";

export function ManageSettingsPage() {
  const { settings, setAiModel, resetSettings } = useAppSettings();
  const [draftModel, setDraftModel] = useState(settings.aiModel);
  const [message, setMessage] = useState("");

  function save() {
    setAiModel(draftModel);
    setMessage("Saved.");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Global management settings used by AI tools."
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
      />

      <ManageTabs active="settings" />

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h2 className="text-base font-semibold">AI Model</h2>
          <Input value={draftModel} onChange={(event) => setDraftModel(event.target.value)} />
          <p className="text-xs text-muted-foreground">
            Used by QA complete-missing and ingestion generation.
          </p>
          {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

