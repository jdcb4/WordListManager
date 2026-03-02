import { useEffect, useMemo, useRef, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";

import { PageHeader } from "../components/common/page-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { DataTable, SortableHeader } from "../components/ui/data-table";
import { EmptyState } from "../components/ui/empty-state";
import { FilterChip } from "../components/ui/filter-chip";
import { Input } from "../components/ui/input";
import { SideDrawer } from "../components/ui/side-drawer";
import { apiGet } from "../lib/http";

const PAGE_SIZE = 100;
const columnHelper = createColumnHelper();

function formatWordTypes(row) {
  if (Array.isArray(row?.word_types) && row.word_types.length) {
    return row.word_types.join(", ");
  }
  return row?.word_type || "-";
}

function MultiSelectHeaderFilter({ options, value, onChange }) {
  return (
    <select
      multiple
      value={value}
      onChange={(event) =>
        onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
      }
      className="mt-1 h-20 w-full rounded border border-input bg-white px-2 py-1 text-xs"
    >
      {options.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function FilterChipRow({ filters, setFilters }) {
  const chips = [];
  if (filters.q) chips.push({ key: "q", label: `Search: ${filters.q}` });
  for (const value of filters.word_type) chips.push({ key: `word_type::${value}`, label: `Type: ${value}` });
  for (const value of filters.category) chips.push({ key: `category::${value}`, label: `Category: ${value}` });
  for (const value of filters.collection) chips.push({ key: `collection::${value}`, label: `Collection: ${value}` });
  for (const value of filters.difficulty) chips.push({ key: `difficulty::${value}`, label: `Difficulty: ${value}` });

  if (!chips.length) return null;

  function clearChip(chipKey) {
    if (chipKey === "q") {
      setFilters((prev) => ({ ...prev, q: "" }));
      return;
    }
    const [field, value] = chipKey.split("::");
    setFilters((prev) => ({ ...prev, [field]: prev[field].filter((item) => item !== value) }));
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <FilterChip key={chip.key} label={chip.label} onClear={() => clearChip(chip.key)} />
      ))}
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
  const [columnVisibility, setColumnVisibility] = useState({
    hint: false,
    subcategory: false,
    updated_at: false,
  });
  const [density, setDensity] = useState("comfortable");
  const [selectedWord, setSelectedWord] = useState(null);

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
      updated_at: "updated_at",
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
      { threshold: 0.15 }
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
      cell: (ctx) => <span className="font-medium">{ctx.getValue()}</span>,
    }),
    columnHelper.accessor("word_type", {
      id: "word_type",
      header: ({ column }) => (
        <div className="min-w-[140px]">
          <SortableHeader title="Type" column={column} />
          <MultiSelectHeaderFilter
            options={["guessing", "describing"]}
            value={filters.word_type}
            onChange={(value) => setFilters((prev) => ({ ...prev, word_type: value }))}
          />
        </div>
      ),
      cell: (ctx) => formatWordTypes(ctx.row.original),
    }),
    columnHelper.accessor("category", {
      id: "category",
      header: ({ column }) => (
        <div className="min-w-[170px]">
          <SortableHeader title="Category" column={column} />
          <MultiSelectHeaderFilter
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
        <div className="min-w-[170px]">
          <SortableHeader title="Collection" column={column} />
          <MultiSelectHeaderFilter
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
            options={["easy", "medium", "hard"]}
            value={filters.difficulty}
            onChange={(value) => setFilters((prev) => ({ ...prev, difficulty: value }))}
          />
        </div>
      ),
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("subcategory", {
      id: "subcategory",
      header: "Subcategory",
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("hint", {
      id: "hint",
      header: "Hint",
      cell: (ctx) => ctx.getValue() || "-",
    }),
    columnHelper.accessor("updated_at", {
      id: "updated_at",
      header: ({ column }) => <SortableHeader title="Updated" column={column} />,
      cell: (ctx) => new Date(ctx.getValue()).toLocaleDateString(),
    }),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Word Library"
        description="Search and browse the published dataset. Filters and sorting update results automatically."
        primaryAction={
          <a className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href="/api/v1/exports/latest.csv">
            Download CSV
          </a>
        }
        secondaryActions={
          <>
            <a className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm" href="/api/v1/exports/latest.json">
              Download JSON
            </a>
            <Button variant="outline" onClick={() => setFilters({ q: "", word_type: [], category: [], collection: [], difficulty: [] })}>
              Clear Filters
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Badge className="justify-center py-2 text-sm">Active words: {stats?.total_active_words ?? "..."}</Badge>
        <Badge className="justify-center py-2 text-sm">Dataset version: {stats?.dataset_version ?? "..."}</Badge>
        <Badge className="justify-center py-2 text-sm">Loaded {rows.length} of {count}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-2 lg:grid-cols-[2fr_auto_auto]">
            <Input
              placeholder="Search word, hint, or phrase"
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={density}
              onChange={(e) => setDensity(e.target.value)}
            >
              <option value="comfortable">Comfortable density</option>
              <option value="compact">Compact density</option>
            </select>
            <details className="rounded-md border border-input bg-white px-3 py-1 text-sm">
              <summary className="cursor-pointer py-1">Columns</summary>
              <div className="space-y-1 py-2">
                {columns.map((column) => (
                  <label key={column.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={columnVisibility[column.id] !== false}
                      onChange={(event) =>
                        setColumnVisibility((prev) => ({ ...prev, [column.id]: event.target.checked }))
                      }
                    />
                    <span>{column.id}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>

          <FilterChipRow filters={filters} setFilters={setFilters} />

          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          {loading ? <div className="text-sm">Loading...</div> : null}

          {!loading && !rows.length ? (
            <EmptyState
              title="No words match these filters"
              description="Try clearing one or more filters or broadening your search query."
              action={<Button variant="outline" onClick={() => setFilters({ q: "", word_type: [], category: [], collection: [], difficulty: [] })}>Reset filters</Button>}
            />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              sorting={sorting}
              onSortingChange={setSorting}
              manualSorting
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              density={density}
              onRowClick={setSelectedWord}
              emptyText="No words found."
            />
          )}

          <div ref={loadMoreRef} className="h-8 text-center text-xs text-muted-foreground">
            {loadingMore ? "Loading more..." : rows.length < count ? "Scroll to load more" : "All rows loaded"}
          </div>
        </CardContent>
      </Card>

      <SideDrawer
        open={!!selectedWord}
        onClose={() => setSelectedWord(null)}
        title={selectedWord?.word || "Word details"}
        subtitle={selectedWord ? `id: ${selectedWord.id}` : ""}
      >
        {selectedWord ? (
          <dl className="space-y-2 text-sm">
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Type</dt><dd>{formatWordTypes(selectedWord)}</dd></div>
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Category</dt><dd>{selectedWord.category || "-"}</dd></div>
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Collection</dt><dd>{selectedWord.collection || "-"}</dd></div>
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Subcategory</dt><dd>{selectedWord.subcategory || "-"}</dd></div>
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Difficulty</dt><dd>{selectedWord.difficulty || "-"}</dd></div>
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Hint</dt><dd>{selectedWord.hint || "-"}</dd></div>
            <div className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted-foreground">Updated</dt><dd>{new Date(selectedWord.updated_at).toLocaleString()}</dd></div>
          </dl>
        ) : null}
      </SideDrawer>
    </div>
  );
}
