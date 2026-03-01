import { useEffect, useState } from "react";

import { ManageTabs } from "../components/common/manage-tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { apiGet, apiPost } from "../lib/http";

export function ManagePage() {
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      const data = await apiPost(action, {});
      setMessage(JSON.stringify(data));
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ManageTabs active="overview" />
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-teal-100 via-sky-50 to-emerald-100">
          <CardTitle>Management Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">Active words</div>
              <div className="text-2xl font-semibold">{dashboard?.total_active_words ?? "..."}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs text-muted-foreground">Dataset version</div>
              <div className="text-2xl font-semibold">{dashboard?.dataset_version ?? "..."}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runAction("/api/v1/manage/publish")} disabled={loading}>One-Click Publish</Button>
            <Button variant="outline" onClick={() => runAction("/api/v1/manage/dedupe")} disabled={loading}>Dedupe</Button>
            <Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
            <a className="rounded-md border border-border bg-white px-4 py-2 text-sm" href="/manage/ai/">AI Tools</a>
          </div>

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "Use tabs to manage staging, AI, validation, and feedback."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
