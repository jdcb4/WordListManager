import { useEffect, useMemo, useRef, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { DataTable, SortableHeader } from "../components/ui/data-table";
import { Input } from "../components/ui/input";
import { apiGet } from "../lib/http";

const PAGE_SIZE = 100;
const columnHelper = createColumnHelper();

function MultiSelectHeaderFilter({ label, options, value, onChange }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium">{label}</div>
      <select
        multiple
        value={value}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
        }
        className="h-20 w-full rounded border border-input bg-white px-2 py-1 text-xs"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LandingPage() {
  const [filters, setFilters] = useState({
    q: "",
    word_type: [],
    category: [],
    collection: [],
    difficulty: [],
  });
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [sorting, setSorting] = useState([{ id: "word", desc: false }]);

  const loadMoreRef = useRef(null);

  const ordering = useMemo(() => {
    const sort = sorting[0];
    if (!sort) return "sanitized_text";
    const map = {
      word: "sanitized_text",
      word_type: "word_type",
      category: "category__name",
      collection: "collection__name",
      difficulty: "difficulty",
    };
    const backendField = map[sort.id] || "sanitized_text";
    return sort.desc ? `-${backendField}` : backendField;
  }, [sorting]);

  const queryBase = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), ordering });
    if (filters.q) params.set("q", filters.q);
    if (filters.word_type.length) params.set("word_type", filters.word_type.join(","));
    if (filters.category.length) params.set("category", filters.category.join(","));
    if (filters.collection.length) params.set("collection", filters.collection.join(","));
    if (filters.difficulty.length) params.set("difficulty", filters.difficulty.join(","));
    return params;
  }, [filters, ordering]);

  async function loadWords({ reset = false } = {}) {
    const nextOffset = reset ? 0 : offset;
    if (reset) {
      setLoading(true);
      setRows([]);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }
    setError("");
    try {
      const params = new URLSearchParams(queryBase);
      params.set("offset", String(nextOffset));
      const data = await apiGet(`/api/v1/words/?${params.toString()}`);
      setCount(data.count || 0);
      setRows((prev) => (reset ? data.results || [] : [...prev, ...(data.results || [])]));
      setOffset(nextOffset + (data.results || []).length);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadWords({ reset: true });
  }, [queryBase.toString()]);

  useEffect(() => {
    apiGet("/api/v1/stats").then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && !loading && rows.length < count) {
          loadWords();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [rows.length, count, loadingMore, loading]);

  const categoryOptions = stats?.categories?.map((item) => item.category__name).filter(Boolean) || [];
  const collectionOptions = stats?.collections?.map((item) => item.collection__name).filter(Boolean) || [];

  const columns = [
    columnHelper.accessor("word", {
      id: "word",
      header: ({ column }) => <SortableHeader title="Word" column={column} />,
    }),
    columnHelper.accessor("word_type", {
      id: "word_type",
      header: ({ column }) => (
        <div className="min-w-[130px]">
          <SortableHeader title="Type" column={column} />
          <MultiSelectHeaderFilter
            label=""
            options={["guessing", "describing"]}
            value={filters.word_type}
            onChange={(value) => setFilters((prev) => ({ ...prev, word_type: value }))}
          />
        </div>
      ),
    }),
    columnHelper.accessor("category", {
      id: "category",
      header: ({ column }) => (
        <div className="min-w-[160px]">
          <SortableHeader title="Category" column={column} />
          <MultiSelectHeaderFilter
            label=""
            options={categoryOptions}
            value={filters.category}
            onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
          />
        </div>
      ),
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("collection", {
      id: "collection",
      header: ({ column }) => (
        <div className="min-w-[160px]">
          <SortableHeader title="Collection" column={column} />
          <MultiSelectHeaderFilter
            label=""
            options={collectionOptions}
            value={filters.collection}
            onChange={(value) => setFilters((prev) => ({ ...prev, collection: value }))}
          />
        </div>
      ),
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("difficulty", {
      id: "difficulty",
      header: ({ column }) => (
        <div className="min-w-[140px]">
          <SortableHeader title="Difficulty" column={column} />
          <MultiSelectHeaderFilter
            label=""
            options={["easy", "medium", "hard"]}
            value={filters.difficulty}
            onChange={(value) => setFilters((prev) => ({ ...prev, difficulty: value }))}
          />
        </div>
      ),
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("hint", {
      id: "hint",
      header: "Hint",
      cell: (ctx) => ctx.getValue() || "-",
    }),
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-sky-100 via-teal-50 to-amber-100">
          <CardTitle>Word Library</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge>Active words: {stats?.total_active_words ?? "..."}</Badge>
            <Badge>Dataset version: {stats?.dataset_version ?? "..."}</Badge>
            <a className="rounded-full border border-border bg-white px-3 py-1" href="/api/v1/exports/latest.csv">Download CSV</a>
            <a className="rounded-full border border-border bg-white px-3 py-1" href="/api/v1/exports/latest.json">Download JSON</a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Input
              placeholder="Search word or phrase"
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
            <Button variant="outline" onClick={() => loadWords({ reset: true })}>Apply Search</Button>
            <Button
              variant="outline"
              onClick={() => setFilters({ q: "", word_type: [], category: [], collection: [], difficulty: [] })}
            >
              Clear All
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Loaded {rows.length} of {count} words.
          </div>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          {loading ? <div className="text-sm">Loading...</div> : null}
          <DataTable
            columns={columns}
            data={rows}
            sorting={sorting}
            onSortingChange={setSorting}
            manualSorting
            emptyText="No words found."
          />
          <div ref={loadMoreRef} className="h-8 text-center text-xs text-muted-foreground">
            {loadingMore ? "Loading more..." : rows.length < count ? "Scroll to load more" : "All rows loaded"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
