import { useEffect, useMemo, useState } from "react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiGet } from "../lib/http";

export function LandingPage() {
  const [filters, setFilters] = useState({
    q: "",
    word_type: "",
    category: "",
    collection: "",
    difficulty: "",
  });
  const [words, setWords] = useState([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: "80", ordering: "sanitized_text" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  async function loadWords() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet(`/api/v1/words/?${queryString}`);
      setWords(data.results || []);
      setCount(data.count || 0);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWords();
  }, [queryString]);

  useEffect(() => {
    apiGet("/api/v1/stats").then(setStats).catch(() => {});
  }, []);

  const categoryOptions = stats?.categories?.map((item) => item.category__name).filter(Boolean) || [];
  const collectionOptions = stats?.collections?.map((item) => item.collection__name).filter(Boolean) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Landing Page (React Transition)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge>Active: {stats?.total_active_words ?? "..."}</Badge>
            <Badge>Version: {stats?.dataset_version ?? "..."}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Search word"
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={filters.word_type}
              onChange={(e) => setFilters((prev) => ({ ...prev, word_type: e.target.value }))}
            >
              <option value="">All types</option>
              <option value="guessing">guessing</option>
              <option value="describing">describing</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={filters.collection}
              onChange={(e) => setFilters((prev) => ({ ...prev, collection: e.target.value }))}
            >
              <option value="">All collections</option>
              {collectionOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={filters.difficulty}
              onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value }))}
            >
              <option value="">All difficulties</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
            <Button variant="outline" onClick={() => setFilters({ q: "", word_type: "", category: "", collection: "", difficulty: "" })}>
              Clear Filters
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {words.length} of {count} words.
          </div>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          {loading ? <div className="text-sm">Loading...</div> : null}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {words.map((word) => (
              <div key={word.id} className="rounded-md border border-border bg-white p-3">
                <div className="text-lg font-semibold">{word.word}</div>
                <div className="text-xs text-muted-foreground">
                  {word.word_type} | {word.category || "-"} | {word.collection || "-"}
                </div>
                <div className="text-sm">{word.hint || "-"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
