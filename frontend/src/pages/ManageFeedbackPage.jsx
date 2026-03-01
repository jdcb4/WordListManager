import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiGet, apiPost } from "../lib/http";

export function ManageFeedbackPage() {
  const [pending, setPending] = useState([]);
  const [counts, setCounts] = useState({ pending_good_count: 0, pending_bad_count: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [resolution, setResolution] = useState("keep");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const data = await apiGet("/api/v1/manage/feedback/pending");
      setPending(data.results || []);
      setCounts({
        pending_good_count: data.pending_good_count || 0,
        pending_bad_count: data.pending_bad_count || 0,
      });
      setSelectedIds([]);
    } catch (err) {
      setMessage(String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  }

  function selectAll() {
    setSelectedIds(pending.map((item) => item.id));
  }

  async function applyResolution() {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost("/api/v1/manage/feedback/resolve", {
        feedback_ids: selectedIds,
        resolution,
        note,
      });
      setMessage(
        `Processed ${data.processed} item(s). Deactivated words: ${data.deactivated_words}.`
      );
      setNote("");
      await refresh();
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Feedback Moderation (React Migration)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-border bg-white p-3 text-sm">
              Pending good: <strong>{counts.pending_good_count}</strong>
            </div>
            <div className="rounded border border-border bg-white p-3 text-sm">
              Pending bad: <strong>{counts.pending_bad_count}</strong>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={selectAll}>Select All</Button>
            <select
              className="h-9 rounded border border-input bg-white px-3 text-sm"
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
            >
              <option value="keep">keep</option>
              <option value="deactivate">deactivate</option>
              <option value="ignore">ignore</option>
            </select>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Moderator note"
            />
            <Button onClick={applyResolution} disabled={loading || selectedIds.length === 0}>
              Apply to Selected
            </Button>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </div>
          <div className="rounded border border-border bg-muted p-3 text-xs">
            {message || "Select rows and apply moderation action."}
          </div>

          <div className="max-h-[560px] overflow-auto rounded border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Select</th>
                  <th className="px-2 py-1 text-left">Word</th>
                  <th className="px-2 py-1 text-left">Verdict</th>
                  <th className="px-2 py-1 text-left">Comment</th>
                  <th className="px-2 py-1 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                      />
                    </td>
                    <td className="px-2 py-1">{item.word}</td>
                    <td className="px-2 py-1">{item.verdict}</td>
                    <td className="px-2 py-1">{item.comment || "-"}</td>
                    <td className="px-2 py-1">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
