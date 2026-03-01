import { useEffect, useMemo, useState } from "react";

import { ManageTabs } from "../components/common/manage-tabs";
import { PageHeader } from "../components/common/page-header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";

function parseWordIds(rawValue) {
  return rawValue
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function ManageAiPage() {
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState(null);
  const [validation, setValidation] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const [generateForm, setGenerateForm] = useState({
    word_type: "guessing",
    count: 20,
    category: "",
    subcategory: "",
    difficulty: "",
    collection: "Base",
  });

  const [completeForm, setCompleteForm] = useState({
    scope: "all_missing",
    word_ids_text: "",
    limit: 200,
  });

  async function refreshSignals() {
    try {
      const [statsData, validationData] = await Promise.all([
        apiGet("/api/v1/stats"),
        apiGet("/api/v1/manage/validate"),
      ]);
      setStats(statsData);
      setValidation(validationData);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refreshSignals();
  }, []);

  const categories = useMemo(
    () => (stats?.categories || []).map((item) => item.category__name).filter(Boolean),
    [stats]
  );
  const collections = useMemo(
    () => (stats?.collections || []).map((item) => item.collection__name).filter(Boolean),
    [stats]
  );

  const missingFieldWordIds = useMemo(() => {
    const issues = validation?.issues || [];
    const targetCodes = new Set(["missing_hint", "missing_collection", "missing_category"]);
    return Array.from(
      new Set(
        issues
          .filter((issue) => targetCodes.has(issue.code) && Number.isInteger(issue.word_id))
          .map((issue) => issue.word_id)
      )
    );
  }, [validation]);

  const selectedWordIds = useMemo(
    () => parseWordIds(completeForm.word_ids_text),
    [completeForm.word_ids_text]
  );

  const estimatedCompleteCount =
    completeForm.scope === "selected_words" ? selectedWordIds.length : missingFieldWordIds.length;

  async function runAction(action, payload, successMessageBuilder) {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost(action, payload);
      setMessage(successMessageBuilder ? successMessageBuilder(data) : JSON.stringify(data));
      await refreshSignals();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  function handleRunCompleteMissing() {
    const payload = {
      model,
      limit: completeForm.limit,
      ...(completeForm.scope === "selected_words" ? { word_ids: selectedWordIds } : {}),
    };
    setConfirmAction({
      kind: "complete",
      title: "Run Complete Missing Fields?",
      description: `Estimated words to process: ${estimatedCompleteCount}. Suggestions are staged for review before publish.`,
      run: () =>
        runAction(
          "/api/v1/manage/ai/complete",
          payload,
          (data) => `Processed ${data.processed}, staged ${data.staged_rows}, batch #${data.batch_id ?? "-"}.`
        ),
    });
  }

  function handleRunGenerate() {
    setConfirmAction({
      kind: "generate",
      title: "Generate new words?",
      description: `Generate up to ${generateForm.count} ${generateForm.word_type} words. Output goes to staging for review.`,
      run: () =>
        runAction(
          "/api/v1/manage/ai/generate",
          { ...generateForm, model },
          (data) => `Generated ${data.generated}/${data.requested} rows, batch #${data.batch_id ?? "-"}.`
        ),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Tools"
        description="Guided AI workflows for generation and missing-field completion. All outputs are written to staging first."
        primaryAction={
          <Button onClick={handleRunGenerate} disabled={loading}>
            Generate to Staging
          </Button>
        }
        secondaryActions={
          <>
            <Button variant="outline" onClick={refreshSignals} disabled={loading}>Refresh signals</Button>
            <a className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm" href="/manage/staging/">
              Open Staging
            </a>
          </>
        }
      />

      <ManageTabs active="ai" />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <h2 className="text-base font-semibold">Complete Missing Fields</h2>
            <p className="text-sm text-muted-foreground">
              Fills blanks such as hint and difficulty, then writes suggestions to staging.
            </p>

            <div className="grid gap-2">
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="AI model" />
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={completeForm.scope}
                onChange={(e) => setCompleteForm((prev) => ({ ...prev, scope: e.target.value }))}
              >
                <option value="all_missing">All words with missing fields</option>
                <option value="selected_words">Only selected word IDs</option>
              </select>

              {completeForm.scope === "selected_words" ? (
                <Input
                  value={completeForm.word_ids_text}
                  onChange={(e) => setCompleteForm((prev) => ({ ...prev, word_ids_text: e.target.value }))}
                  placeholder="Word IDs, comma separated"
                />
              ) : null}

              <Input
                type="number"
                min="1"
                max="2000"
                value={completeForm.limit}
                onChange={(e) => setCompleteForm((prev) => ({ ...prev, limit: Number(e.target.value || 200) }))}
                placeholder="Limit"
              />

              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Estimated count: {estimatedCompleteCount}
              </div>

              <Button
                onClick={handleRunCompleteMissing}
                disabled={loading || (completeForm.scope === "selected_words" && selectedWordIds.length === 0)}
              >
                Complete Missing to Staging
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-4">
            <h2 className="text-base font-semibold">Generate New Words</h2>
            <p className="text-sm text-muted-foreground">
              Schema-aware generation. Categories are limited to configured active categories.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.word_type}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, word_type: e.target.value }))}
              >
                <option value="guessing">guessing</option>
                <option value="describing">describing</option>
              </select>
              <Input
                type="number"
                min="1"
                max="50"
                value={generateForm.count}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, count: Number(e.target.value || 20) }))}
              />
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.category}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="">(no category)</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.collection}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, collection: e.target.value }))}
              >
                {["Base", ...collections.filter((item) => item !== "Base")].map((collection) => (
                  <option key={collection} value={collection}>{collection}</option>
                ))}
              </select>
              <Input value={generateForm.subcategory} onChange={(e) => setGenerateForm((prev) => ({ ...prev, subcategory: e.target.value }))} placeholder="Subcategory" />
              <select
                className="h-9 rounded border border-input bg-white px-3 text-sm"
                value={generateForm.difficulty}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, difficulty: e.target.value }))}
              >
                <option value="">(any difficulty)</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </div>

            <Button onClick={handleRunGenerate} disabled={loading}>Preview + Generate</Button>
          </CardContent>
        </Card>
      </div>

      {!stats ? <EmptyState title="Loading AI setup signals" description="Fetching category and validation context..." /> : null}

      <Card>
        <CardContent className="pt-4">
          <div className="rounded-md border border-border bg-muted p-3 text-sm">
            {message || "AI runs are staged only. Final publish still goes through staging and validation workflows."}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || "Confirm action"}
        description={confirmAction?.description}
        confirmLabel={loading ? "Running..." : "Run"}
        onConfirm={() => confirmAction?.run?.()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
