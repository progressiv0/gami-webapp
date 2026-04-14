"use client";

import { Loader2, RefreshCw, Stamp, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GprRow, GprStatus } from "@/lib/types";
import { GprTable } from "./GprTable";
import { SignDialog } from "./SignDialog";

type Tab = "all" | GprStatus;

interface ListResponse {
  rows: GprRow[];
  total: number;
  page: number;
  pageSize: number;
  collections: string[];
}

export function GprArchive() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>((searchParams.get("status") as Tab) ?? "all");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [collection, setCollection] = useState(searchParams.get("collection") ?? "");
  const [page] = useState(1);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [signOpen, setSignOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const params = new URLSearchParams({ page: String(page) });
    if (tab !== "all") params.set("status", tab);
    if (search) params.set("search", search);
    if (collection) params.set("collection", collection);
    try {
      const res = await fetch(`/api/gprs?${params}`);
      const json = await res.json() as ListResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [tab, search, collection, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleToggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleToggleAll() {
    if (!data) return;
    const allIds = data.rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  async function handleBulkStamp() {
    setBulkLoading(true);
    const ids = [...selected];
    for (const id of ids) {
      try {
        await fetch(`/api/gprs/${encodeURIComponent(id)}/stamp`, { method: "POST" });
      } catch { /* continue */ }
    }
    setBulkLoading(false);
    fetchData();
  }

  async function handleBulkUpgrade() {
    setBulkLoading(true);
    const ids = [...selected];
    for (const id of ids) {
      try {
        await fetch(`/api/gprs/${encodeURIComponent(id)}/upgrade`, { method: "POST" });
      } catch { /* continue */ }
    }
    setBulkLoading(false);
    fetchData();
  }

  const selectedRows = data?.rows.filter((r) => selected.has(r.id)) ?? [];

  const tabCounts = {
    all: data?.total ?? 0,
  };

  function tabLabel(t: Tab, label: string) {
    const count = (data?.rows.filter((r) => t === "all" || r.status === t).length) ?? 0;
    return `${label}`;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">GPR Archive</h1>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search filename, hash, collection…"
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={collection || "_all"} onValueChange={(v) => setCollection(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All collections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All collections</SelectItem>
            {data?.collections.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchData}>Apply</Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelected(new Set()); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unsigned">Unsigned</TabsTrigger>
          <TabsTrigger value="signed">Signed</TabsTrigger>
          <TabsTrigger value="stamped">Stamped</TabsTrigger>
          <TabsTrigger value="upgraded">Confirmed</TabsTrigger>
        </TabsList>

        {/* Bulk action toolbar */}
        {selected.size > 0 && (
          <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{selected.size} selected</span>
            {tab === "unsigned" && (
              <Button size="sm" onClick={() => setSignOpen(true)}>
                Sign selected
              </Button>
            )}
            {tab === "signed" && (
              <Button size="sm" onClick={handleBulkStamp} disabled={bulkLoading}>
                {bulkLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Stamp className="mr-1 h-4 w-4" />}
                Stamp selected
              </Button>
            )}
            {tab === "stamped" && (
              <Button size="sm" onClick={handleBulkUpgrade} disabled={bulkLoading}>
                {bulkLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-1 h-4 w-4" />}
                Upgrade selected
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {(["all", "unsigned", "signed", "stamped", "upgraded"] as Tab[]).map((t) => (
          <TabsContent key={t} value={t}>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <GprTable
                rows={data?.rows.filter((r) => t === "all" || r.status === t) ?? []}
                selected={selected}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
                status={t}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Pagination hint */}
      {data && data.total > data.pageSize && (
        <p className="text-xs text-muted-foreground">
          Showing {data.rows.length} of {data.total} records.
        </p>
      )}

      {/* Sign dialog */}
      <SignDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        gprs={selectedRows}
        onDone={() => { setSignOpen(false); fetchData(); }}
      />
    </div>
  );
}
