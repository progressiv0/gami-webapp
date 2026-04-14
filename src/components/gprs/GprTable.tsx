"use client";

import { ArrowUpDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import type { GprRow, GprStatus } from "@/lib/types";
import { GprStatusBadge } from "./GprStatusBadge";

interface Props {
  rows: GprRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  status?: GprStatus | "all";
}

function formatHash(hash: string) {
  const hex = hash.replace("sha256:", "");
  return hex.slice(0, 8) + "…" + hex.slice(-4);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function GprTable({ rows, selected, onToggle, onToggleAll, status }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">
        No records found.
      </div>
    );
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="w-10 px-3 py-3 text-left">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-3 text-left font-medium">
              <span className="flex items-center gap-1">
                Filename <ArrowUpDown className="h-3 w-3 opacity-50" />
              </span>
            </th>
            <th className="px-3 py-3 text-left font-medium">File hash</th>
            {(!status || status === "all") && (
              <th className="px-3 py-3 text-left font-medium">Status</th>
            )}
            <th className="px-3 py-3 text-left font-medium">Collection</th>
            <th className="px-3 py-3 text-left font-medium">Created</th>
            {(status === "stamped" || status === "upgraded") && (
              <th className="px-3 py-3 text-left font-medium">Calendar</th>
            )}
            <th className="w-10 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`transition-colors hover:bg-muted/30 ${selected.has(row.id) ? "bg-muted/20" : ""}`}
            >
              <td className="px-3 py-2.5">
                <Checkbox
                  checked={selected.has(row.id)}
                  onCheckedChange={() => onToggle(row.id)}
                  aria-label={`Select ${row.filename || row.id}`}
                />
              </td>
              <td className="px-3 py-2.5 max-w-[180px] truncate font-medium">
                {row.filename || <span className="text-muted-foreground italic">unnamed</span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {formatHash(row.fileHash)}
              </td>
              {(!status || status === "all") && (
                <td className="px-3 py-2.5">
                  <GprStatusBadge status={row.status} />
                </td>
              )}
              <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">
                {row.collection || "—"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                {formatDate(row.createdAt)}
              </td>
              {(status === "stamped" || status === "upgraded") && (
                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate">
                  {row.data.proof.timestamp?.calendar
                    ? new URL(row.data.proof.timestamp.calendar).hostname
                    : "—"}
                </td>
              )}
              <td className="px-3 py-2.5">
                <Link
                  href={`/dashboard/gprs/${encodeURIComponent(row.id)}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
