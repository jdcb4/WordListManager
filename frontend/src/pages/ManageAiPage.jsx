import { useState } from "react";

import { ManageTabs } from "../components/common/manage-tabs";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiPost } from "../lib/http";

export function ManageAiPage() {
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [generateForm, setGenerateForm] = useState({
    word_type: "guessing",
    count: 20,
    category: "",
    subcategory: "",
    difficulty: "",
    collection: "Base",
  });

  async function runAction(action, payload) {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost(action, payload);
      setMessage(JSON.stringify(data));
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ManageTabs active="ai" />
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-100 via-cyan-50 to-emerald-100">
          <CardTitle>AI Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-sm" value={model} onChange={(e) => setModel(e.target.value)} placeholder="model" />
            <Button
              onClick={() => runAction("/api/v1/manage/ai/complete", { model, limit: 200 })}
              disabled={loading}
            >
              Complete Missing To Staging
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
            <Input value={generateForm.category} onChange={(e) => setGenerateForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="category" />
            <Input value={generateForm.subcategory} onChange={(e) => setGenerateForm((prev) => ({ ...prev, subcategory: e.target.value }))} placeholder="subcategory" />
            <Input value={generateForm.difficulty} onChange={(e) => setGenerateForm((prev) => ({ ...prev, difficulty: e.target.value }))} placeholder="difficulty" />
            <Input value={generateForm.collection} onChange={(e) => setGenerateForm((prev) => ({ ...prev, collection: e.target.value }))} placeholder="collection" />
          </div>
          <Button
            onClick={() => runAction("/api/v1/manage/ai/generate", { ...generateForm, model })}
            disabled={loading}
          >
            Generate Words To Staging
          </Button>

          <div className="rounded-md border border-border bg-muted p-3 text-xs">
            {message || "AI actions write results into staging for review."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
